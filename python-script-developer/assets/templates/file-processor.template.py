#!/usr/bin/env python3
"""
File Processor - Process files in batch with progress tracking

This script processes multiple files with parallel execution support,
progress tracking, and comprehensive error handling.

Version: 1.0
Author: {{AUTHOR}}
License: MIT
"""

import argparse
import logging
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Tuple, Optional
from dataclasses import dataclass

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False
    print("Warning: tqdm not installed. Install with: pip install tqdm")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants
VERSION = "1.0.0"


@dataclass
class ProcessResult:
    """Result of processing a single file."""
    filepath: Path
    success: bool
    error: Optional[str] = None
    lines_processed: int = 0


class Colors:
    """ANSI color codes."""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'


def parse_args() -> argparse.Namespace:
    """
    Parse command-line arguments.

    Returns:
        Parsed arguments
    """
    parser = argparse.ArgumentParser(
        description='Process multiple files with progress tracking',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Process all .txt files in directory
    %(prog)s /path/to/files --pattern "*.txt"

    # Process recursively with 4 workers
    %(prog)s /path/to/files -r --workers 4

    # Dry run to see what would be processed
    %(prog)s /path/to/files --dry-run
        """
    )

    parser.add_argument(
        'directory',
        type=Path,
        help='Directory containing files to process'
    )

    parser.add_argument(
        '-p', '--pattern',
        default='*.txt',
        help='File pattern (glob) to match (default: *.txt)'
    )

    parser.add_argument(
        '-r', '--recursive',
        action='store_true',
        help='Process subdirectories recursively'
    )

    parser.add_argument(
        '-o', '--output-dir',
        type=Path,
        help='Output directory (default: same as input)'
    )

    parser.add_argument(
        '-w', '--workers',
        type=int,
        default=4,
        help='Number of parallel workers (default: 4)'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be processed without making changes'
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


def find_files(
    directory: Path,
    pattern: str = "*.txt",
    recursive: bool = False
) -> List[Path]:
    """
    Find all files matching pattern in directory.

    Args:
        directory: Directory to search
        pattern: File pattern (glob)
        recursive: Search subdirectories

    Returns:
        List of matching file paths

    Raises:
        ValueError: If directory doesn't exist or isn't a directory
    """
    if not directory.exists():
        raise ValueError(f"Directory doesn't exist: {directory}")

    if not directory.is_dir():
        raise ValueError(f"Path is not a directory: {directory}")

    search_func = directory.rglob if recursive else directory.glob
    files = [f for f in search_func(pattern) if f.is_file()]

    logger.info(f"Found {len(files)} files matching '{pattern}'")
    return files


def process_file(
    filepath: Path,
    output_dir: Optional[Path] = None
) -> ProcessResult:
    """
    Process a single file.

    Args:
        filepath: Path to file to process
        output_dir: Optional output directory

    Returns:
        ProcessResult with status and metadata
    """
    try:
        logger.debug(f"Processing {filepath}")

        # Read file
        content = filepath.read_text(encoding='utf-8')
        lines = content.splitlines()

        # TODO: Add your processing logic here
        # Example: Convert to uppercase
        processed = content.upper()

        # Determine output path
        if output_dir:
            output_path = output_dir / filepath.name
        else:
            output_path = filepath.with_suffix('.processed' + filepath.suffix)

        # Write processed content
        output_path.write_text(processed, encoding='utf-8')

        return ProcessResult(
            filepath=filepath,
            success=True,
            lines_processed=len(lines)
        )

    except UnicodeDecodeError as e:
        error_msg = f"Failed to decode file: {e}"
        logger.error(f"{filepath}: {error_msg}")
        return ProcessResult(
            filepath=filepath,
            success=False,
            error=error_msg
        )

    except Exception as e:
        error_msg = str(e)
        logger.error(f"{filepath}: {error_msg}")
        return ProcessResult(
            filepath=filepath,
            success=False,
            error=error_msg
        )


def process_files_parallel(
    files: List[Path],
    output_dir: Optional[Path] = None,
    workers: int = 4,
    show_progress: bool = True
) -> List[ProcessResult]:
    """
    Process multiple files in parallel.

    Args:
        files: List of file paths to process
        output_dir: Optional output directory
        workers: Number of parallel workers
        show_progress: Show progress bar

    Returns:
        List of ProcessResult objects
    """
    results = []

    # Create iterator with or without progress bar
    iterator = tqdm(total=len(files), desc="Processing", unit="file") if (HAS_TQDM and show_progress) else None

    with ThreadPoolExecutor(max_workers=workers) as executor:
        # Submit all tasks
        future_to_file = {
            executor.submit(process_file, filepath, output_dir): filepath
            for filepath in files
        }

        # Process completed tasks
        for future in as_completed(future_to_file):
            result = future.result()
            results.append(result)

            if iterator:
                iterator.update(1)
                # Update description with current file
                iterator.set_postfix_str(f"Last: {result.filepath.name}")

    if iterator:
        iterator.close()

    return results


def print_summary(results: List[ProcessResult]) -> None:
    """
    Print processing summary.

    Args:
        results: List of processing results
    """
    total = len(results)
    successful = sum(1 for r in results if r.success)
    failed = total - successful
    total_lines = sum(r.lines_processed for r in results if r.success)

    print("\n" + "=" * 60)
    print("Processing Summary")
    print("=" * 60)

    print(f"{Colors.GREEN}✓ Successful:{Colors.RESET} {successful}/{total}")

    if failed > 0:
        print(f"{Colors.RED}✗ Failed:{Colors.RESET} {failed}/{total}")
        print("\nFailed files:")
        for result in results:
            if not result.success:
                print(f"  {Colors.RED}✗{Colors.RESET} {result.filepath}")
                if result.error:
                    print(f"    Error: {result.error}")

    print(f"\nTotal lines processed: {total_lines:,}")
    print("=" * 60)


def main() -> int:
    """
    Main entry point.

    Returns:
        Exit code
    """
    args = parse_args()

    # Configure logging
    if args.verbose:
        logger.setLevel(logging.DEBUG)
        logger.debug("Debug logging enabled")

    try:
        # Find files to process
        files = find_files(
            directory=args.directory,
            pattern=args.pattern,
            recursive=args.recursive
        )

        if not files:
            print(f"{Colors.YELLOW}⚠ No files found matching pattern: {args.pattern}{Colors.RESET}")
            return 0

        # Dry run mode
        if args.dry_run:
            print(f"{Colors.BLUE}DRY RUN - Would process {len(files)} files:{Colors.RESET}")
            for filepath in files[:10]:  # Show first 10
                print(f"  - {filepath}")
            if len(files) > 10:
                print(f"  ... and {len(files) - 10} more")
            return 0

        # Create output directory if specified
        if args.output_dir:
            args.output_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"Output directory: {args.output_dir}")

        # Process files
        print(f"{Colors.BLUE}Processing {len(files)} files with {args.workers} workers...{Colors.RESET}\n")

        results = process_files_parallel(
            files=files,
            output_dir=args.output_dir,
            workers=args.workers,
            show_progress=not args.verbose  # Hide progress bar in verbose mode
        )

        # Print summary
        print_summary(results)

        # Return appropriate exit code
        failed_count = sum(1 for r in results if not r.success)
        return 0 if failed_count == 0 else 1

    except ValueError as e:
        logger.error(str(e))
        print(f"{Colors.RED}✗ Error: {e}{Colors.RESET}")
        return 1

    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}⚠ Interrupted by user{Colors.RESET}")
        return 130

    except Exception as e:
        logger.exception("Unexpected error")
        print(f"{Colors.RED}✗ Unexpected error: {e}{Colors.RESET}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
