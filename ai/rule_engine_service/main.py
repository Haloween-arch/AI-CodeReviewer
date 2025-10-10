# ai/rule_engine_service/main.py
from fastapi import FastAPI, Request
import ast

app = FastAPI(title="Rule Engine Service")


class NestedLoopVisitor(ast.NodeVisitor):
    def __init__(self):
        self.max_depth = 0

    def visit_For(self, node):
        self._visit_loop(node, 1)
        self.generic_visit(node)

    def visit_While(self, node):
        self._visit_loop(node, 1)
        self.generic_visit(node)

    def _visit_loop(self, node, depth):
        # Update max depth when we enter a loop
        self.max_depth = max(self.max_depth, depth)

        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.For, ast.While)):
                self._visit_loop(child, depth + 1)


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

    issues = []
    if visitor.max_depth >= 2:
        issues.append({
            "pattern": "nested_loops",
            "depth": visitor.max_depth,
            "message": f"Nested loops detected (depth {visitor.max_depth}) — consider refactoring"
        })

    return {"rule_issues": issues}
