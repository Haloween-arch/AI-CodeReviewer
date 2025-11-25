from pydantic import BaseModel
from typing import Dict, List, Any
from datetime import datetime

class AnalysisRecord(BaseModel):
    timestamp: datetime
    language: str
    summary: Dict[str, Any]
    issues: List[Dict[str, Any]]
