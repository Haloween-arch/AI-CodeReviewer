# ai/rule_engine_service/main.py
from fastapi import FastAPI, Request
import ast

app = FastAPI(title="Rule Engine Service")

class NestedLoopVisitor(ast.NodeVisitor):
    def __init__(self):
        self.max_depth = 0

    def visit_FunctionDef(self, node):
        self._visit_loop(node, 0)
        self.generic_visit(node)

    def _visit_loop(self, node, depth):
        for child in ast.walk(node):
            if isinstance(child, (ast.For, ast.While)):
                self.max_depth = max(self.max_depth, depth + 1)
                for inner in ast.iter_child_nodes(child):
                    if isinstance(inner, (ast.For, ast.While)):
                        self._visit_loop(inner, depth + 1)

@app.post("/analyze/rule")
async def analyze_rule(request: Request):
    body = await request.json()
    code = body.get("code", "")
    if not isinstance(code, str):
        return {"error": "code must be a string"}

    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return {"error": "syntax", "details": str(e)}

    visitor = NestedLoopVisitor()
    visitor.visit(tree)
    nested = visitor.max_depth

    issues = []
    if nested >= 2:
        issues.append({
            "pattern": "nested_loops",
            "depth": nested,
            "message": "Nested loops detected — consider refactoring"
        })

    return {"rule_issues": issues}
