#!/usr/bin/env python3
"""
Validate Python Script - Check if a Python script follows best practices

This script validates Python scripts against the python-script-developer skill
best practices checklist.

Usage:
    python validate-script.py script.py
    python validate-script.py script.py --verbose

Version: 1.0.0
Author: Python Script Developer Skill
License: MIT
"""

import argparse
import ast
import re
import sys
from pathlib import Path
from typing import List, Tuple
from dataclasses import dataclass


@dataclass
class ValidationResult:
    """Result of a validation check."""
    name: str
    passed: bool
    message: str


class Colors:
    """ANSI color codes."""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    RESET = '\033[0m'


def check_shebang(content: str) -> ValidationResult:
    """Check if script has proper shebang."""
    if content.startswith('#!/usr/bin/env python3'):
        return ValidationResult(
            name="Shebang",
            passed=True,
            message="Has proper shebang"
        )
    return ValidationResult(
        name="Shebang",
        passed=False,
        message="Missing or incorrect shebang (should be #!/usr/bin/env python3)"
    )


def check_module_docstring(tree: ast.Module) -> ValidationResult:
    """Check if module has docstring."""
    if ast.get_docstring(tree):
        return ValidationResult(
            name="Module Docstring",
            passed=True,
            message="Has module docstring"
        )
    return ValidationResult(
        name="Module Docstring",
        passed=False,
        message="Missing module docstring"
    )


def check_type_hints(tree: ast.Module) -> ValidationResult:
    """Check if functions have type hints."""
    functions = [node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]

    if not functions:
        return ValidationResult(
            name="Type Hints",
            passed=True,
            message="No functions to check"
        )

    untyped_functions = []
    for func in functions:
        # Skip private functions and __init__
        if func.name.startswith('_') and func.name != '__init__':
            continue

        # Check if function has return type hint
        if func.returns is None and func.name != '__init__':
            untyped_functions.append(func.name)
            continue

        # Check if arguments have type hints
        for arg in func.args.args:
            if arg.annotation is None and arg.arg != 'self':
                untyped_functions.append(f"{func.name}:{arg.arg}")

    if not untyped_functions:
        return ValidationResult(
            name="Type Hints",
            passed=True,
            message=f"All {len(functions)} functions have type hints"
        )

    return ValidationResult(
        name="Type Hints",
        passed=False,
        message=f"Missing type hints in: {', '.join(untyped_functions[:3])}"
    )


def check_function_docstrings(tree: ast.Module) -> ValidationResult:
    """Check if functions have docstrings."""
    functions = [
        node for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef) and not node.name.startswith('_')
    ]

    if not functions:
        return ValidationResult(
            name="Docstrings",
            passed=True,
            message="No functions to check"
        )

    missing_docstrings = [
        func.name for func in functions
        if not ast.get_docstring(func)
    ]

    if not missing_docstrings:
        return ValidationResult(
            name="Docstrings",
            passed=True,
            message=f"All {len(functions)} public functions have docstrings"
        )

    return ValidationResult(
        name="Docstrings",
        passed=False,
        message=f"Missing docstrings: {', '.join(missing_docstrings[:3])}"
    )


def check_main_guard(content: str) -> ValidationResult:
    """Check if script has main guard."""
    if "if __name__ == '__main__':" in content or 'if __name__ == "__main__":' in content:
        return ValidationResult(
            name="Main Guard",
            passed=True,
            message="Has main guard"
        )
    return ValidationResult(
        name="Main Guard",
        passed=False,
        message="Missing if __name__ == '__main__' guard"
    )


def check_logging(tree: ast.Module) -> ValidationResult:
    """Check if script uses logging instead of print."""
    imports = [
        node for node in ast.walk(tree)
        if isinstance(node, ast.Import) or isinstance(node, ast.ImportFrom)
    ]

    has_logging = any(
        (isinstance(node, ast.Import) and any(alias.name == 'logging' for alias in node.names)) or
        (isinstance(node, ast.ImportFrom) and node.module == 'logging')
        for node in imports
    )

    if has_logging:
        return ValidationResult(
            name="Logging",
            passed=True,
            message="Uses logging module"
        )

    return ValidationResult(
        name="Logging",
        passed=False,
        message="No logging import found (prefer logging over print)"
    )


def check_pathlib(tree: ast.Module) -> ValidationResult:
    """Check if script uses pathlib instead of os.path."""
    imports = [
        node for node in ast.walk(tree)
        if isinstance(node, ast.Import) or isinstance(node, ast.ImportFrom)
    ]

    has_pathlib = any(
        (isinstance(node, ast.ImportFrom) and node.module == 'pathlib') or
        (isinstance(node, ast.Import) and any('pathlib' in alias.name for alias in node.names))
        for node in imports
    )

    has_os_path = any(
        (isinstance(node, ast.Import) and any('os' in alias.name for alias in node.names)) or
        (isinstance(node, ast.ImportFrom) and node.module == 'os.path')
        for node in imports
    )

    if has_pathlib and not has_os_path:
        return ValidationResult(
            name="Pathlib",
            passed=True,
            message="Uses pathlib.Path"
        )
    elif has_os_path:
        return ValidationResult(
            name="Pathlib",
            passed=False,
            message="Uses os.path instead of pathlib"
        )
    else:
        return ValidationResult(
            name="Pathlib",
            passed=True,
            message="No path operations detected"
        )


def check_argparse(tree: ast.Module) -> ValidationResult:
    """Check if script uses argparse for CLI arguments."""
    imports = [
        node for node in ast.walk(tree)
        if isinstance(node, ast.Import) or isinstance(node, ast.ImportFrom)
    ]

    has_argparse = any(
        (isinstance(node, ast.Import) and any(alias.name == 'argparse' for alias in node.names)) or
        (isinstance(node, ast.ImportFrom) and node.module == 'argparse')
        for node in imports
    )

    # Check if sys.argv is used (indicating manual argument parsing)
    has_sys_argv = any(
        isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and node.value.id == 'sys'
        and node.attr == 'argv'
        for node in ast.walk(tree)
    )

    if has_argparse:
        return ValidationResult(
            name="Argparse",
            passed=True,
            message="Uses argparse for CLI arguments"
        )
    elif has_sys_argv:
        return ValidationResult(
            name="Argparse",
            passed=False,
            message="Uses sys.argv instead of argparse"
        )
    else:
        return ValidationResult(
            name="Argparse",
            passed=True,
            message="No CLI arguments detected"
        )


def check_error_handling(tree: ast.Module) -> ValidationResult:
    """Check if script has proper error handling."""
    try_blocks = [node for node in ast.walk(tree) if isinstance(node, ast.Try)]

    if not try_blocks:
        return ValidationResult(
            name="Error Handling",
            passed=False,
            message="No try-except blocks found"
        )

    # Check for bare except clauses
    bare_except = any(
        any(handler.type is None for handler in try_node.handlers)
        for try_node in try_blocks
    )

    if bare_except:
        return ValidationResult(
            name="Error Handling",
            passed=False,
            message="Found bare except: clause (use specific exceptions)"
        )

    return ValidationResult(
        name="Error Handling",
        passed=True,
        message=f"Has {len(try_blocks)} try-except blocks with specific exceptions"
    )


def validate_script(filepath: Path, verbose: bool = False) -> Tuple[List[ValidationResult], int]:
    """
    Validate a Python script against best practices.

    Args:
        filepath: Path to Python script
        verbose: Show detailed output

    Returns:
        Tuple of (results list, score percentage)
    """
    if not filepath.exists():
        raise FileNotFoundError(f"File not found: {filepath}")

    content = filepath.read_text(encoding='utf-8')

    try:
        tree = ast.parse(content)
    except SyntaxError as e:
        return ([ValidationResult(
            name="Syntax",
            passed=False,
            message=f"Syntax error: {e}"
        )], 0)

    # Run all checks
    results = [
        check_shebang(content),
        check_module_docstring(tree),
        check_type_hints(tree),
        check_function_docstrings(tree),
        check_main_guard(content),
        check_logging(tree),
        check_pathlib(tree),
        check_argparse(tree),
        check_error_handling(tree)
    ]

    # Calculate score
    passed = sum(1 for r in results if r.passed)
    total = len(results)
    score = int((passed / total) * 100)

    return results, score


def print_results(results: List[ValidationResult], score: int, verbose: bool = False) -> None:
    """Print validation results."""
    print(f"\n{'=' * 60}")
    print("Python Script Validation Results")
    print(f"{'=' * 60}\n")

    for result in results:
        symbol = f"{Colors.GREEN}✓{Colors.RESET}" if result.passed else f"{Colors.RED}✗{Colors.RESET}"
        print(f"{symbol} {result.name}: {result.message}")

    print(f"\n{'=' * 60}")

    if score == 100:
        color = Colors.GREEN
        message = "Excellent! Follows all best practices"
    elif score >= 80:
        color = Colors.GREEN
        message = "Good! Most best practices followed"
    elif score >= 60:
        color = Colors.YELLOW
        message = "Fair. Some improvements needed"
    else:
        color = Colors.RED
        message = "Needs improvement"

    print(f"Score: {color}{score}%{Colors.RESET} - {message}")
    print(f"{'=' * 60}\n")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Validate Python scripts against best practices'
    )
    parser.add_argument(
        'script',
        type=Path,
        help='Python script to validate'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Show detailed output'
    )

    args = parser.parse_args()

    try:
        results, score = validate_script(args.script, args.verbose)
        print_results(results, score, args.verbose)

        # Return 0 if score is 80% or higher
        return 0 if score >= 80 else 1

    except FileNotFoundError as e:
        print(f"{Colors.RED}✗ Error: {e}{Colors.RESET}")
        return 1
    except Exception as e:
        print(f"{Colors.RED}✗ Unexpected error: {e}{Colors.RESET}")
        return 2


if __name__ == '__main__':
    sys.exit(main())
