export function detectLanguage(filename, code) {
  const ext = filename.split('.').pop().toLowerCase()

  const map = {
    py: "python",
    js: "javascript",
    java: "java",
    cpp: "cpp",
    h: "cpp"
  }

  if (map[ext]) return map[ext]

  if (code.includes("import java")) return "java"
  if (code.includes("#include")) return "cpp"
  if (code.includes("function") || code.includes("console.log")) return "javascript"

  return "python"
}
