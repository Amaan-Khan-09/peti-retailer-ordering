import json
from pathlib import Path

from .make_scheme_fixtures import expected

CASES = json.loads((Path(__file__).parent / "fixtures" / "scheme_cases.json").read_text(encoding="utf-8"))


def test_engine_still_matches_the_shared_cases():
    """The same file is checked by the TypeScript engine used offline (frontend/src/offline/pricing.test.ts)."""
    for case in CASES:
        assert expected(case["item"], case["qty"], case["unit"]) == case["expect"], case["name"]
