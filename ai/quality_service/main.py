# ai/quality_service/main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import radon.complexity as rc
from radon.metrics import mi_visit
import inspect, timeit, tracemalloc, numpy as np, math, random

app = FastAPI(title="Quality Service (LeetCode-Style Accurate Big-O)")

# ---------------------------------------------------------------------
# Helper: Adaptive argument generator
# ---------------------------------------------------------------------
def make_args_for_func(sig, n: int):
    args = []
    for name, param in sig.parameters.items():
        lname = name.lower()
        if lname in ("arr", "lst", "nums", "data", "array"):
            args.append(list(range(n)))
        elif lname in ("matrix", "grid", "mat"):
            side = max(1, int(math.sqrt(n)))
            args.append([[random.randint(0, 9) for _ in range(side)] for _ in range(side)])
        elif lname.startswith(("b", "m")):
            args.append(max(1, n // 5))
        elif lname.startswith("s"):
            args.append("x" * min(1000, n))
        elif lname.startswith("t") or "target" in lname:
            args.append(n // 2)
        else:
            args.append(n)
    return args

# ---------------------------------------------------------------------
# New: Log–log regression-based complexity estimator
# ---------------------------------------------------------------------
def estimate_complexity(ns, times):
    """Estimate time complexity using log–log regression like LeetCode."""
    try:
        ns, times = np.array(ns, dtype=float), np.array(times, dtype=float)
        valid = (times > 0)
        ns, times = ns[valid], times[valid]
        if len(ns) < 2:
            return "O(1)"
        slope, _ = np.polyfit(np.log(ns), np.log(times), 1)
        p = round(slope, 2)
        if p < 0.5: return "O(1)"
        elif p < 1.5: return "O(n)"
        elif p < 2.5: return "O(n^2)"
        elif p < 3.5: return "O(n^3)"
        elif p < 5: return "O(2^n)"
        else: return "O(n!)"
    except Exception:
        return "N/A"

# ---------------------------------------------------------------------
# Memory complexity (simplified)
# ---------------------------------------------------------------------
def estimate_space_complexity(ns, mems):
    try:
        ns, mems = np.array(ns, dtype=float), np.array(mems, dtype=float)
        slope, _ = np.polyfit(np.log(ns + 1), np.log(mems + 1), 1)
        p = round(slope, 2)
        if p < 0.5: return "O(1)"
        elif p < 1.5: return "O(n)"
        elif p < 2.5: return "O(n^2)"
        else: return "O(n^3)"
    except Exception:
        return "N/A"

# ---------------------------------------------------------------------
# Measure runtime & memory
# ---------------------------------------------------------------------
def measure_runtime_and_memory(code: str, func_name: str):
    try:
        global_env = {}
        exec(code, global_env)
        if func_name not in global_env:
            return {"error": f"Function '{func_name}' not found"}

        test_func = global_env[func_name]
        sig = inspect.signature(test_func)
        input_sizes = [10, 50, 100, 200, 400]
        times, mem_peaks = [], []

        for n in input_sizes:
            args = make_args_for_func(sig, n)
            try:
                tracemalloc.start()
                exec_time = timeit.timeit(lambda: test_func(*args), number=3)
                _, peak = tracemalloc.get_traced_memory()
                tracemalloc.stop()
                times.append(exec_time)
                mem_peaks.append(peak)
            except Exception as e:
                tracemalloc.stop()
                return {"error": f"Failed at n={n}: {e}"}

        return {
            "time_seconds_per_input": dict(zip(map(str, input_sizes), times)),
            "peak_memory_bytes_per_input": dict(zip(map(str, input_sizes), mem_peaks)),
            "estimated_time_complexity": estimate_complexity(input_sizes, times),
            "estimated_space_complexity": estimate_space_complexity(input_sizes, mem_peaks),
        }

    except Exception as e:
        return {"error": str(e)}

# ---------------------------------------------------------------------
# Main API endpoint
# ---------------------------------------------------------------------
@app.post("/analyze/quality")
async def analyze_quality(request: Request):
    try:
        body = await request.json()
        code = body.get("code", "")
        if not isinstance(code, str):
            return JSONResponse({"error": "Invalid code type"}, status_code=400)

        # Cyclomatic complexity
        try:
            blocks = rc.cc_visit(code)
            funcs = [{"name": b.name, "lineno": b.lineno, "complexity": b.complexity} for b in blocks]
        except Exception as e:
            funcs = [{"error": f"Radon parse error: {e}"}]

        # Maintainability
        try:
            mi = mi_visit(code, True)
        except Exception:
            mi = None

        # Performance profiling
        performance = {}
        for f in funcs:
            if "name" in f:
                performance[f["name"]] = measure_runtime_and_memory(code, f["name"])

        return {
            "functions": funcs,
            "maintainability_index": mi,
            "performance": performance,
            "error": None
        }

    except Exception as e:
        return JSONResponse({"error": f"Internal failure: {e}"}, status_code=500)
