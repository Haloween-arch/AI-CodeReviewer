# ai/quality_service/main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import radon.complexity as rc
from radon.metrics import mi_visit
import inspect, timeit, tracemalloc, numpy as np, math, random

app = FastAPI(title="Quality Service (LeetCode-Style Enhanced)")

# -------------------------------
# Helper: Generate mock args for a function
# -------------------------------
def make_args_for_func(sig, n: int):
    """Automatically generate reasonable arguments based on parameter names and count."""
    args = []
    for name, param in sig.parameters.items():
        lname = name.lower()
        if lname in ("arr", "lst", "nums", "data"):
            args.append(list(range(n)))
        elif lname in ("matrix", "grid", "mat"):
            side = max(1, int(math.sqrt(n)))
            args.append([[0] * side for _ in range(side)])
        elif lname.startswith("b"):
            args.append(max(1, n // 10))
        elif lname.startswith("m"):
            args.append(max(1, n // 2))
        elif lname.startswith("s"):
            args.append("a" * min(1000, n))
        else:
            args.append(n)
    return args


# -------------------------------
# Big-O Model Curves
# -------------------------------
def models(n):
    n = np.array(n, dtype=float)
    max_n = max(n)
    scaled = n / max_n
    return {
        "O(1)": np.ones_like(n),
        "O(log n)": np.log(n + 1),
        "O(n)": n,
        "O(n log n)": n * np.log(n + 1),
        "O(n^2)": n ** 2,
        "O(n^3)": n ** 3,
        "O(2^n)": 2 ** (scaled * 10),
    }

complexity_order = ["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n^2)", "O(n^3)", "O(2^n)"]

# -------------------------------
# Complexity Fitting
# -------------------------------
def best_fit_complexity(ns, values):
    n = np.array(ns, dtype=float)
    y = np.array(values, dtype=float)
    if len(y) == 0 or np.any(np.isnan(y)):
        return None

    candidates = models(n)
    best_label, best_error = None, float("inf")

    for label in complexity_order:
        f = candidates[label]
        a, b = np.polyfit(f, y, 1)
        y_pred = a * f + b
        rel_error = np.mean(np.abs((y - y_pred) / np.maximum(y, 1e-9)))
        penalty = 1.0
        if "2^n" in label:
            penalty = 1.15
        elif "n^3" in label:
            penalty = 1.05
        score = rel_error * penalty
        if score < best_error:
            best_error, best_label = score, label

    return best_label or "O(1)"


# -------------------------------
# Runtime + Memory Profiler
# -------------------------------
def measure_runtime_and_memory(code: str, func_name: str):
    try:
        global_env = {}
        exec(code, global_env)
        if func_name not in global_env:
            return {"error": f"Function '{func_name}' not found"}
        test_func = global_env[func_name]

        sig = inspect.signature(test_func)
        input_sizes = [50, 100, 500, 1000]
        times, mem_peaks = [], []

        for n in input_sizes:
            args = make_args_for_func(sig, n)
            try:
                tracemalloc.start()
                exec_time = timeit.timeit(lambda: test_func(*args), number=2)
                _, peak = tracemalloc.get_traced_memory()
                tracemalloc.stop()
            except Exception as e:
                tracemalloc.stop()
                return {"error": f"Error running '{func_name}' with n={n}: {e}"}
            times.append(exec_time)
            mem_peaks.append(peak)

        return {
            "time_seconds_per_input": dict(zip(map(str, input_sizes), times)),
            "peak_memory_bytes_per_input": dict(zip(map(str, input_sizes), mem_peaks)),
            "estimated_time_complexity": best_fit_complexity(input_sizes, times),
            "estimated_space_complexity": best_fit_complexity(input_sizes, mem_peaks),
        }

    except Exception as e:
        return {"error": str(e)}


# -------------------------------
# Main Endpoint
# -------------------------------
@app.post("/analyze/quality")
async def analyze_quality(request: Request):
    body = await request.json()
    code = body.get("code", "")
    if not isinstance(code, str):
        return JSONResponse({"error": "code must be a string"}, status_code=400)

    try:
        blocks = rc.cc_visit(code)
        funcs = [{"name": b.name, "lineno": b.lineno, "complexity": b.complexity} for b in blocks]
    except Exception as e:
        funcs = [{"error": str(e)}]

    try:
        mi = mi_visit(code, True)
    except Exception:
        mi = None

    performance = {}
    if funcs and "name" in funcs[0]:
        for f in funcs:
            performance[f["name"]] = measure_runtime_and_memory(code, f["name"])

    return {
        "functions": funcs,
        "maintainability_index": mi,
        "performance": performance,
    }
