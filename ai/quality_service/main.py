# ai/quality_service/main.py
# Multi-language Quality Service (Python / Java / C++)
# - POST /analyze/quality expects {"code": "...", "language":"python|java|cpp"}
# - returns cyclomatic complexity (radon for python), MI, time & space measures and estimated complexities.

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import ast, inspect, time, timeit, tracemalloc, math, random, tempfile, os, shutil, subprocess, json
from typing import List, Dict, Any, Tuple
import numpy as np
import radon.complexity as rc
from radon.metrics import mi_visit

# optional psutil for better memory sampling of external processes
try:
    import psutil
except Exception:
    psutil = None

app = FastAPI(title="Quality Service — MultiLang (Python/Java/C++)")

# -----------------------
# Argument generator (multi-param aware)
# -----------------------
def make_args_for_sig_names(param_names: List[str], n: int):
    args = []
    for lname in param_names:
        name = lname.lower()
        if name in ("arr", "lst", "nums", "data", "array"):
            args.append(list(range(n)))
        elif name in ("matrix", "grid", "mat"):
            side = max(1, int(math.sqrt(n)))
            args.append([[random.randint(0,9) for _ in range(side)] for _ in range(side)])
        elif name.startswith(("b","m")):
            args.append(max(1, n // 5))
        elif name.startswith("s") or "str" in name:
            args.append("x" * min(500, n))
        elif "target" in name or name.startswith("t"):
            args.append(n//2)
        elif name == "k":
            args.append(max(1, min(10, n//10)))
        else:
            args.append(n)
    return args

# -----------------------
# Models to test (include O(log n))
# canonical model functions (normalized where necessary)
# -----------------------
def canonical_models(n_arr):
    n = np.array(n_arr, dtype=float)
    n_pos = np.maximum(n, 1.0)
    scaled = n_pos / n_pos.max()
    return {
        "O(1)": np.ones_like(n_pos),
        "O(log n)": np.log(n_pos + 1.0),
        "O(n)": n_pos,
        "O(n log n)": n_pos * np.log(n_pos + 1.0),
        "O(n^2)": n_pos ** 2,
        "O(n^3)": n_pos ** 3,
        # exponential family - model by b^(scaled*C)
        "O(2^n)": np.exp(np.log(2.0) * (scaled * 10.0)),   # steep growth
        "O(c^n)": np.exp(scaled * 10.0)                    # generic exponential shape
    }

# -----------------------
# Fit helpers
# -----------------------
def fit_and_score(model_vals, times):
    # linear regression fit times ~ a * model_vals + b
    try:
        a, b = np.polyfit(model_vals, times, 1)
        y_pred = a * model_vals + b
        # relative error metric (robust to scale)
        rel_err = np.mean(np.abs((times - y_pred) / np.maximum(times, 1e-9)))
        # R^2
        ss_res = np.sum((times - y_pred) ** 2)
        ss_tot = np.sum((times - times.mean()) ** 2) + 1e-12
        r2 = 1 - ss_res / ss_tot
        return rel_err, float(r2)
    except Exception:
        return float("inf"), 0.0

def estimate_time_complexity(ns: List[int], times: List[float]) -> str:
    # robust selection among canonical models + log-log polynomial
    try:
        if len(times) < 2:
            return "N/A"
        n = np.array(ns, dtype=float)
        t = np.array(times, dtype=float)
        # if times are flat or tiny, O(1)
        if np.max(t) < 1e-6 or (len(t)>1 and (np.std(t)/(np.mean(t)+1e-12)) < 0.03):
            return "O(1)"
        # try log-log polynomial (detect n^k)
        try:
            ln_n = np.log(n + 1e-12)
            ln_t = np.log(t + 1e-12)
            a, b = np.polyfit(ln_n, ln_t, 1)
            y_pred = a * ln_n + b
            ss_res = np.sum((ln_t - y_pred)**2)
            ss_tot = np.sum((ln_t - ln_t.mean())**2) + 1e-12
            r2_poly = 1 - ss_res / ss_tot
            exponent = a
        except Exception:
            r2_poly = 0.0
            exponent = None
        # evaluate canonical models including O(log n)
        models = canonical_models(ns)
        best_label = None
        best_score = float("inf")
        best_r2 = -1.0
        for label, fvals in models.items():
            rel_err, r2 = fit_and_score(fvals, t)
            # penalty to avoid overfitting by complex models
            penalty = 1.0
            if label in ("O(2^n)","O(c^n)"):
                penalty *= 1.15
            elif "^3" in label:
                penalty *= 1.05
            score = rel_err * penalty
            if score < best_score:
                best_score = score
                best_label = label
                best_r2 = r2
        # compare poly fit
        if exponent is not None and r2_poly > max(best_r2, 0.6):
            # translate exponent to friendly label
            if exponent < 0.5:
                return "O(1)"
            if exponent < 1.5:
                return "O(n)"
            if exponent < 2.5:
                return "O(n^2)"
            if exponent < 3.5:
                return "O(n^3)"
            return f"O(n^{round(float(exponent),1)})"
        # if model selected is exponential-like, return explicit
        if best_label in ("O(2^n","O(2^n)","O(c^n)"):
            return "O(2^n) (approx)"
        # post-process best_label to canonical format
        if best_label:
            return best_label
        # fallback: slope in log-log
        try:
            a, _ = np.polyfit(np.log(n+1e-12), np.log(t+1e-12), 1)
            k = round(float(a),1)
            return f"O(n^{k})" if k>0.5 else "O(1)"
        except Exception:
            return "N/A"
    except Exception:
        return "N/A"

def estimate_space_complexity(ns: List[int], mems: List[float]) -> str:
    try:
        if len(mems) < 2:
            return "N/A"
        n = np.array(ns, dtype=float)
        m = np.array(mems, dtype=float) + 1.0
        a, b = np.polyfit(np.log(n + 1.0), np.log(m), 1)
        slope = float(a)
        if slope < 0.5:
            return "O(1)"
        elif slope < 1.5:
            return "O(n)"
        elif slope < 2.5:
            return "O(n^2)"
        else:
            return "O(n^3)"
    except Exception:
        return "N/A"

# -----------------------
# Python measurement (child process safe runner)
# -----------------------
from multiprocessing import Process, Pipe
def _py_child_runner(code_text: str, func_name: str, args, reps: int, conn):
    import time, tracemalloc, sys, io, traceback
    try:
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        ns = {}
        exec(code_text, ns)
        if func_name not in ns:
            raise RuntimeError(f"Function '{func_name}' not found")
        fn = ns[func_name]
        # warmup
        try:
            fn(*args)
        except Exception:
            pass
        tracemalloc.start()
        t0 = time.perf_counter()
        for _ in range(reps):
            fn(*args)
        t1 = time.perf_counter()
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        out = sys.stdout.getvalue()
        sys.stdout = old_stdout
        conn.send({"ok":True,"elapsed":(t1-t0),"peak":peak,"stdout":out,"exception":None})
    except Exception:
        tb = traceback.format_exc()
        try:
            sys.stdout = old_stdout
        except Exception:
            pass
        conn.send({"ok":False,"elapsed":None,"peak":None,"stdout":"","exception":tb})
    finally:
        try:
            conn.close()
        except Exception:
            pass

def run_python_measure(code_text: str, func_name: str, args: list, reps: int, timeout: float=2.0):
    parent_conn, child_conn = Pipe()
    p = Process(target=_py_child_runner, args=(code_text, func_name, args, reps, child_conn))
    p.daemon = True
    p.start()
    start = time.time()
    while time.time() - start < timeout:
        if parent_conn.poll(0.05):
            break
    result = None
    if parent_conn.poll():
        try:
            result = parent_conn.recv()
        except Exception:
            result = None
    else:
        try:
            p.terminate()
        except Exception:
            pass
        result = {"ok": False, "elapsed": None, "peak": None, "stdout": "", "exception": "timeout"}
    p.join(timeout=0.1)
    try:
        parent_conn.close()
    except Exception:
        pass
    return result

# -----------------------
# Java / C++ helpers: compile & run with generated harness
# For Java: assume single public class name Main (or wrap into Main)
# For C++: compile into executable
# Measure by launching subprocess and sampling RSS with psutil if available
# -----------------------
def write_temp_file(dirpath: str, filename: str, content: str):
    p = os.path.join(dirpath, filename)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content)
    return p

def measure_native_process(cmd: List[str], stdin_bytes: bytes = b"", timeout: float = 2.0, sample_interval: float = 0.02):
    """
    Run cmd as subprocess, measure elapsed time and peak RSS memory.
    If psutil available, sample using psutil.Process(pid).memory_info().rss
    Otherwise attempt to poll process with wait + no accurate peak.
    """
    try:
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except Exception as e:
        return {"ok": False, "elapsed": None, "peak": None, "stdout": "", "stderr": str(e), "exception": str(e)}
    start = time.perf_counter()
    peak = 0
    try:
        if psutil:
            proc = psutil.Process(p.pid)
            # poll while process running
            while True:
                if p.poll() is not None:
                    break
                try:
                    rss = proc.memory_info().rss
                    if rss > peak:
                        peak = rss
                except Exception:
                    pass
                time.sleep(sample_interval)
            # read stdout/stderr
            out, err = p.communicate(input=stdin_bytes, timeout=0.5)
        else:
            # no psutil: wait for completion (less accurate)
            out, err = p.communicate(input=stdin_bytes, timeout=timeout+0.5)
            # best-effort peak: use 0
            peak = 0
        end = time.perf_counter()
        return {"ok": True, "elapsed": (end-start), "peak": int(peak), "stdout": out.decode(errors="ignore"), "stderr": err.decode(errors="ignore"), "exception": None}
    except subprocess.TimeoutExpired:
        try:
            p.kill()
        except Exception:
            pass
        return {"ok": False, "elapsed": None, "peak": peak, "stdout":"", "stderr":"timeout", "exception":"timeout"}
    except Exception as e:
        try:
            p.kill()
        except Exception:
            pass
        return {"ok": False, "elapsed": None, "peak": peak, "stdout":"", "stderr":str(e), "exception":str(e)}

def compile_and_run_java(code: str, class_name: str, func_invocation_snippet: str, args_serialized: str, dirpath: str):
    """
    We will write a wrapper Java class (Main) that contains the user's code (if class_name==Main we try to use it),
    or else we wrap the user's function into a static method and call it from Main.
    For simplicity we will place user code into the file and attempt javac; this is heuristic and requires Java in PATH.
    """
    # user-provided code might be a full class. We'll create a Main runner that calls a static method 'entry' if present.
    runner = f"""
// Auto-generated wrapper - do not edit
public class __Runner {{
    public static void main(String[] argv) {{
        try {{
            // call user's entry (if exists) with args via string parsing
            String argStr = "{args_serialized}";
            // user 'entry' should accept single int param; wrapper tries to parse first token
            int n = 0;
            try {{ n = Integer.parseInt(argStr); }} catch(Exception ex) {{ }}
            // call user entry
            Object res = null;
            try {{
                res = UserEntry.entry(n);
                if(res != null) System.out.println(res.toString());
            }} catch (Throwable e) {{
                System.err.println("USER_EXCEPTION:"+e.toString());
                e.printStackTrace();
            }}
        }} catch (Throwable t) {{
            t.printStackTrace();
        }}
    }}
}}
"""
    # create dir files
    user_filename = os.path.join(dirpath, "UserEntry.java")
    with open(user_filename, "w", encoding="utf-8") as f:
        f.write(code)
    runner_fn = os.path.join(dirpath, "__Runner.java")
    with open(runner_fn, "w", encoding="utf-8") as f:
        f.write(runner)
    # compile
    proc = subprocess.run(["javac", "UserEntry.java", "__Runner.java"], cwd=dirpath, capture_output=True, timeout=10)
    if proc.returncode != 0:
        return {"ok":False, "elapsed":None, "peak":None, "stdout":"", "stderr":proc.stderr.decode(), "exception":"compile_error"}
    # run
    return measure_native_process(["java", "-cp", dirpath, "__Runner"], timeout=3.0)

def compile_and_run_cpp(code: str, dirpath: str):
    # write user code to file expecting a function `int entry(int n)` or a full program; we will enforce returning something
    user_fn = os.path.join(dirpath, "user.cpp")
    with open(user_fn, "w", encoding="utf-8") as f:
        f.write(code)
    exe = os.path.join(dirpath, "a.out")
    # compile
    proc = subprocess.run(["g++", "user.cpp", "-O2", "-std=c++17", "-o", "a.out"], cwd=dirpath, capture_output=True, timeout=10)
    if proc.returncode != 0:
        return {"ok":False, "elapsed":None, "peak":None, "stdout":"", "stderr":proc.stderr.decode(), "exception":"compile_error"}
    # run
    return measure_native_process([exe], timeout=3.0)

# -----------------------
# High-level measurement per-language per-function
# -----------------------
def measure_code_multilang(code: str, language: str, func_name: str = None) -> Dict[str,Any]:
    language = (language or "python").lower()
    # choose input sizes small to medium (keeps runtime bounded)
    input_sizes = [8, 32, 128] if language=="python" else [16, 64, 256]
    times = []
    mems = []
    used_sizes = []

    # python path uses signature introspection
    if language == "python":
        # find function names with radon or ast; if func_name provided, only that
        try:
            # exec to get signature
            env = {}
            exec(code, env)
            avail_funcs = [k for k,v in env.items() if inspect.isfunction(v)]
        except Exception as e:
            return {"error": f"python exec parse error: {e}"}
        target_funcs = [func_name] if func_name else avail_funcs
        if not target_funcs:
            return {"error":"no function found in python code"}
        # measure each provided function separately (report only first in summary)
        perf = {}
        for fname in target_funcs:
            # signature
            try:
                sig = inspect.signature(env[fname])
                param_names = list(sig.parameters.keys())
            except Exception:
                param_names = []
            times = []; mems = []; used_sizes = []
            for n in input_sizes:
                args = make_args_for_sig_names(param_names, n)
                # pick reps adaptively
                reps = 1
                res = run_python_measure(code, fname, args, reps, timeout=1.2)
                if not res or not res.get("ok"):
                    return {"error": f"Failed small-run for {fname}: {res.get('exception') if res else 'no result'}"}
                single = res["elapsed"] / max(1, reps)
                if single < 0.005:
                    reps = int(max(1, min(200, math.ceil(0.02 / max(single,1e-9)))))
                else:
                    reps = 3
                res = run_python_measure(code, fname, args, reps, timeout=3.0)
                if not res or not res.get("ok"):
                    return {"error": f"Failed at n={n}: {res.get('exception') if res else 'no result'}"}
                times.append(res["elapsed"]/max(1,reps))
                mems.append(int(res["peak"] or 0))
                used_sizes.append(n)
                if times[-1] > 1.2:
                    break
            perf[fname] = {
                "time_seconds_per_input": dict(zip(map(str, used_sizes), times)),
                "peak_memory_bytes_per_input": dict(zip(map(str, used_sizes), mems)),
                "estimated_time_complexity": estimate_time_complexity(used_sizes, times),
                "estimated_space_complexity": estimate_space_complexity(used_sizes, mems)
            }
        return {"performance": perf}
    else:
        # native path (Java / C++): compile + run with small harness. We assume user code is a full program or contains a function the wrapper can call.
        # We'll write the code to a temp dir and attempt to compile/run.
        tmp = tempfile.mkdtemp(prefix="qsvc_")
        try:
            if language == "java":
                # For Java we expect user to provide a class 'UserEntry' with 'public static Object entry(int n)'
                # We'll compile and run wrapper; measure times for n in input_sizes by invoking java runner with args passed as system property (simplified)
                times = []; mems = []; used_sizes = []
                for n in input_sizes:
                    # compile & run wrapper for this n
                    # create temporary copy per-run (to simplify)
                    run_res = compile_and_run_java(code, class_name="UserEntry", func_invocation_snippet="", args_serialized=str(n), dirpath=tmp)
                    if not run_res.get("ok"):
                        return {"error": f"Java run/compile failed: {run_res.get('stderr') or run_res.get('exception')}"}
                    times.append(run_res["elapsed"])
                    mems.append(int(run_res["peak"] or 0))
                    used_sizes.append(n)
                    if run_res["elapsed"] and run_res["elapsed"] > 1.5:
                        break
                return {
                    "performance": {
                        "main": {
                            "time_seconds_per_input": dict(zip(map(str, used_sizes), times)),
                            "peak_memory_bytes_per_input": dict(zip(map(str, used_sizes), mems)),
                            "estimated_time_complexity": estimate_time_complexity(used_sizes, times),
                            "estimated_space_complexity": estimate_space_complexity(used_sizes, mems)
                        }
                    }
                }
            elif language in ("c++","cpp","cxx"):
                times = []; mems = []; used_sizes = []
                for n in input_sizes:
                    # we could wrap user's code, but here we assume user code is a full program that reads n from stdin or uses a main constant
                    # as a simple approach, try compiling and running; for more complex functions user must adapt code to consume n
                    run_res = compile_and_run_cpp(code, tmp)
                    if not run_res.get("ok"):
                        return {"error": f"C++ compile/run failed: {run_res.get('stderr') or run_res.get('exception')}"}
                    times.append(run_res["elapsed"])
                    mems.append(int(run_res["peak"] or 0))
                    used_sizes.append(n)
                    if run_res["elapsed"] and run_res["elapsed"] > 1.5:
                        break
                return {
                    "performance": {
                        "main": {
                            "time_seconds_per_input": dict(zip(map(str, used_sizes), times)),
                            "peak_memory_bytes_per_input": dict(zip(map(str, used_sizes), mems)),
                            "estimated_time_complexity": estimate_time_complexity(used_sizes, times),
                            "estimated_space_complexity": estimate_space_complexity(used_sizes, mems)
                        }
                    }
                }
            else:
                return {"error": f"unsupported language: {language}"}
        finally:
            try:
                shutil.rmtree(tmp)
            except Exception:
                pass

# -----------------------
# Analyze code entrypoint (keeps radon for Python, basic heuristics for Java/C++)
# -----------------------
@app.post("/analyze/quality")
async def analyze_quality(request: Request):
    try:
        body = await request.json()
        code = body.get("code","")
        language = (body.get("language","python") or "python").lower()
        if not isinstance(code, str) or not code.strip():
            return JSONResponse({"error":"code must be a non-empty string"}, status_code=400)

        result = {
            "functions": [],
            "maintainability_index": None,
            "performance": {},
            "summary": [],
            "error": None
        }

        # For Python: use radon to list functions and MI
        if language == "python":
            try:
                blocks = rc.cc_visit(code)
                funcs = [{"name": b.name, "lineno": b.lineno, "complexity": b.complexity} for b in blocks]
                result["functions"] = funcs
            except Exception as e:
                result["functions"] = [{"error": f"radon parse error: {e}"}]
            try:
                result["maintainability_index"] = mi_visit(code, True)
            except Exception:
                result["maintainability_index"] = None

            # measure all detected functions
            perf = {}
            summary = []
            for f in result["functions"]:
                if "name" not in f:
                    continue
                fname = f["name"]
                meas = measure_code_multilang(code, "python", func_name=fname)
                if "error" in meas:
                    perf[fname] = {"error": meas["error"]}
                else:
                    perf[fname] = meas["performance"].get(fname) if isinstance(meas.get("performance"), dict) and fname in meas["performance"] else next(iter(meas.get("performance", {}).values()))
                summary.append({
                    "function": fname,
                    "time_complexity": perf[fname].get("estimated_time_complexity") if isinstance(perf[fname], dict) else None,
                    "space_complexity": perf[fname].get("estimated_space_complexity") if isinstance(perf[fname], dict) else None
                })
            result["performance"] = perf
            result["summary"] = summary
            return result

        # For Java/C++: attempt to compile & run and provide performance summary
        elif language in ("java","c++","cpp","cxx"):
            # Provide basic info: radon isn't available; for Java/C++ we return performance on the whole program
            meas = measure_code_multilang(code, language)
            if "error" in meas:
                return {"error": meas["error"]}
            result["performance"] = meas.get("performance", {})
            # minimal summary
            for k,v in result["performance"].items():
                result["summary"].append({
                    "function": k,
                    "time_complexity": v.get("estimated_time_complexity"),
                    "space_complexity": v.get("estimated_space_complexity")
                })
            return result
        else:
            return JSONResponse({"error": f"Unsupported language '{language}'"}, status_code=400)
    except Exception as e:
        return JSONResponse({"error": f"internal: {e}"}, status_code=500)
