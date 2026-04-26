#!/usr/bin/env python3
"""
CSV Analyzer - Analyze CSV files and generate summary statistics

This example demonstrates best practices for Python scripting:
- Type hints for all functions
- Proper error handling with specific exceptions
- Argparse for CLI interface
- Logging instead of print statements
- pathlib.Path for file operations
- Progress bars with tqdm
- Comprehensive docstrings
- Main guard and exit codes

Usage:
    python csv-analyzer.py data.csv
    python csv-analyzer.py data.csv --output summary.json
    python csv-analyzer.py data/ --pattern "*.csv" --recursive

Version: 1.0.0
Author: Example Developer
License: MIT
"""

import argparse
import csv
import json
import logging
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Dict, Any, Optional
from collections import Counter

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Constants
SCRIPT_DIR = Path(__file__).resolve().parent
VERSION = "1.0.0"


@dataclass
class CSVStats:
    """Statistics for a CSV file."""
    filename: str
    row_count: int
    column_count: int
    columns: List[str]
    missing_values: Dict[str, int]
    numeric_columns: List[str]
    text_columns: List[str]


class Colors:
    """ANSI color codes for terminal output."""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'


def parse_args() -> argparse.Namespace:
    """
    Parse command-line arguments.

    Returns:
        Parsed arguments namespace
    """
    parser = argparse.ArgumentParser(
        description='Analyze CSV files and generate statistics',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Analyze single CSV file
    %(prog)s data.csv

    # Analyze and save results to JSON
    %(prog)s data.csv --output summary.json

    # Analyze all CSV files in directory
    %(prog)s data/ --pattern "*.csv" --recursive

    # Verbose output with debug info
    %(prog)s data.csv -v
        """
    )

    parser.add_argument(
        'input',
        type=Path,
        help='Input CSV file or directory'
    )

    parser.add_argument(
        '-o', '--output',
        type=Path,
        help='Output file for results (JSON format)'
    )

    parser.add_argument(
        '-p', '--pattern',
        default='*.csv',
        help='File pattern for directory processing (default: *.csv)'
    )

    parser.add_argument(
        '-r', '--recursive',
        action='store_true',
        help='Process directories recursively'
    )

    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose output'
    )

    parser.add_argument(
        '--version',
        action='version',
        version=f'%(prog)s {VERSION}'
    )

    return parser.parse_args()


def is_numeric(value: str) -> bool:
    """
    Check if a string value is numeric.

    Args:
        value: String value to check

    Returns:
        True if value is numeric
    """
    try:
        float(value)
        return True
    except (ValueError, TypeError):
        return False


def analyze_csv(filepath: Path) -> CSVStats:
    """
    Analyze a CSV file and extract statistics.

    Args:
        filepath: Path to CSV file

    Returns:
        CSVStats object with analysis results

    Raises:
        FileNotFoundError: If file doesn't exist
        csv.Error: If file is not valid CSV
    """
    if not filepath.exists():
        raise FileNotFoundError(f"File not found: {filepath}")

    logger.info(f"Analyzing {filepath}")

    # Read CSV file
    with filepath.open('r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        # Get column names
        if reader.fieldnames is None:
            raise csv.Error(f"No columns found in {filepath}")

        columns = list(reader.fieldnames)

        # Initialize counters
        row_count = 0
        missing_values: Counter[str] = Counter()
        column_types: Dict[str, List[bool]] = {col: [] for col in columns}

        # Process rows
        for row in reader:
            row_count += 1

            for column in columns:
                value = row.get(column, '').strip()

                # Count missing values
                if not value:
                    missing_values[column] += 1
                    column_types[column].append(False)  # Not numeric
                else:
                    column_types[column].append(is_numeric(value))

        # Determine column types
        numeric_columns = []
        text_columns = []

        for column, is_num_list in column_types.items():
            # If majority of non-empty values are numeric, consider it numeric
            numeric_count = sum(is_num_list)
            total_count = len(is_num_list)

            if total_count > 0 and numeric_count / total_count > 0.8:
                numeric_columns.append(column)
            else:
                text_columns.append(column)

        return CSVStats(
            filename=filepath.name,
            row_count=row_count,
            column_count=len(columns),
            columns=columns,
            missing_values=dict(missing_values),
            numeric_columns=numeric_columns,
            text_columns=text_columns
        )


def find_csv_files(
    path: Path,
    pattern: str = "*.csv",
    recursive: bool = False
) -> List[Path]:
    """
    Find all CSV files in path.

    Args:
        path: Directory or file path
        pattern: File pattern (glob)
        recursive: Search recursively

    Returns:
        List of CSV file paths
    """
    if path.is_file():
        return [path]

    if path.is_dir():
        search_func = path.rglob if recursive else path.glob
        files = list(search_func(pattern))
        logger.info(f"Found {len(files)} CSV files")
        return files

    raise ValueError(f"Path is neither file nor directory: {path}")


def print_stats(stats: CSVStats) -> None:
    """
    Print statistics in human-readable format.

    Args:
        stats: CSV statistics
    """
    print(f"\n{Colors.BLUE}{'=' * 60}{Colors.RESET}")
    print(f"{Colors.BLUE}File: {stats.filename}{Colors.RESET}")
    print(f"{Colors.BLUE}{'=' * 60}{Colors.RESET}")

    print(f"Rows: {stats.row_count:,}")
    print(f"Columns: {stats.column_count}")

    print(f"\n{Colors.GREEN}Numeric columns ({len(stats.numeric_columns)}):{Colors.RESET}")
    for col in stats.numeric_columns:
        missing = stats.missing_values.get(col, 0)
        if missing > 0:
            print(f"  - {col} ({missing} missing)")
        else:
            print(f"  - {col}")

    print(f"\n{Colors.YELLOW}Text columns ({len(stats.text_columns)}):{Colors.RESET}")
    for col in stats.text_columns:
        missing = stats.missing_values.get(col, 0)
        if missing > 0:
            print(f"  - {col} ({missing} missing)")
        else:
            print(f"  - {col}")

    # Show columns with most missing values
    if stats.missing_values:
        top_missing = sorted(
            stats.missing_values.items(),
            key=lambda x: x[1],
            reverse=True
        )[:3]

        print(f"\n{Colors.RED}Columns with missing values:{Colors.RESET}")
        for col, count in top_missing:
            percentage = (count / stats.row_count) * 100
            print(f"  - {col}: {count} ({percentage:.1f}%)")


def main() -> int:
    """
    Main entry point.

    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    args = parse_args()

    # Configure logging
    if args.verbose:
        logger.setLevel(logging.DEBUG)
        logger.debug("Debug logging enabled")

    try:
        # Find CSV files
        csv_files = find_csv_files(
            path=args.input,
            pattern=args.pattern,
            recursive=args.recursive
        )

        if not csv_files:
            print(f"{Colors.YELLOW}⚠ No CSV files found{Colors.RESET}")
            return 0

        # Analyze all files
        all_stats: List[CSVStats] = []

        iterator = tqdm(csv_files, desc="Analyzing", unit="file") if HAS_TQDM else csv_files

        for filepath in iterator:
            try:
                stats = analyze_csv(filepath)
                all_stats.append(stats)

                if not HAS_TQDM:
                    print(f"{Colors.GREEN}✓{Colors.RESET} Analyzed {filepath.name}")

            except Exception as e:
                logger.error(f"Failed to analyze {filepath}: {e}")
                print(f"{Colors.RED}✗{Colors.RESET} Failed: {filepath.name}")

        if not all_stats:
            print(f"{Colors.RED}✗ No files were successfully analyzed{Colors.RESET}")
            return 1

        # Print results
        for stats in all_stats:
            print_stats(stats)

        # Save to output file if specified
        if args.output:
            output_data = [asdict(s) for s in all_stats]
            args.output.write_text(
                json.dumps(output_data, indent=2),
                encoding='utf-8'
            )
            print(f"\n{Colors.GREEN}✓ Results saved to {args.output}{Colors.RESET}")

        print(f"\n{Colors.GREEN}✓ Successfully analyzed {len(all_stats)} file(s){Colors.RESET}")
        return 0

    except FileNotFoundError as e:
        logger.error(str(e))
        print(f"{Colors.RED}✗ File not found: {e}{Colors.RESET}")
        return 1

    except ValueError as e:
        logger.error(str(e))
        print(f"{Colors.RED}✗ Invalid input: {e}{Colors.RESET}")
        return 2

    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        print(f"\n{Colors.YELLOW}⚠ Operation cancelled by user{Colors.RESET}")
        return 130

    except Exception as e:
        logger.exception("Unexpected error occurred")
        print(f"{Colors.RED}✗ Unexpected error: {e}{Colors.RESET}")
        if args.verbose:
            raise
        return 3


if __name__ == '__main__':
    sys.exit(main())
