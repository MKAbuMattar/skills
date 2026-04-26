#!/usr/bin/env python3
"""
{{TOOL_NAME}} - {{TOOL_DESCRIPTION}}

A CLI tool with subcommands for {{PURPOSE}}.

Version: 1.0
Author: {{AUTHOR}}
License: MIT
"""

import argparse
import logging
import sys
from pathlib import Path
from typing import Optional, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants
SCRIPT_DIR = Path(__file__).resolve().parent
VERSION = "1.0.0"


class Colors:
    """ANSI color codes."""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'


def create_parser() -> argparse.ArgumentParser:
    """
    Create argument parser with subcommands.

    Returns:
        Configured ArgumentParser
    """
    parser = argparse.ArgumentParser(
        description='{{TOOL_DESCRIPTION}}',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    # Global options
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

    # Subcommands
    subparsers = parser.add_subparsers(
        dest='command',
        required=True,
        help='Available commands'
    )

    # Init command
    init_parser = subparsers.add_parser(
        'init',
        help='Initialize a new project'
    )
    init_parser.add_argument(
        'name',
        help='Project name'
    )
    init_parser.add_argument(
        '--template',
        choices=['basic', 'advanced', 'minimal'],
        default='basic',
        help='Project template'
    )

    # Build command
    build_parser = subparsers.add_parser(
        'build',
        help='Build the project'
    )
    build_parser.add_argument(
        '--release',
        action='store_true',
        help='Build in release mode'
    )
    build_parser.add_argument(
        '--output',
        type=Path,
        help='Output directory'
    )

    # Deploy command
    deploy_parser = subparsers.add_parser(
        'deploy',
        help='Deploy the project'
    )
    deploy_parser.add_argument(
        '--env',
        choices=['dev', 'staging', 'prod'],
        default='dev',
        help='Target environment'
    )
    deploy_parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Simulate deployment without making changes'
    )

    # Status command
    status_parser = subparsers.add_parser(
        'status',
        help='Show project status'
    )
    status_parser.add_argument(
        '--format',
        choices=['text', 'json', 'yaml'],
        default='text',
        help='Output format'
    )

    return parser


def cmd_init(args: argparse.Namespace) -> int:
    """
    Initialize a new project.

    Args:
        args: Parsed command-line arguments

    Returns:
        Exit code
    """
    logger.info(f"Initializing project: {args.name}")
    logger.info(f"Using template: {args.template}")

    project_dir = Path.cwd() / args.name

    try:
        # Check if directory exists
        if project_dir.exists():
            print(f"{Colors.RED}✗ Directory already exists: {project_dir}{Colors.RESET}")
            return 1

        # Create project structure
        project_dir.mkdir(parents=True)
        logger.debug(f"Created directory: {project_dir}")

        # Create subdirectories
        (project_dir / "src").mkdir()
        (project_dir / "tests").mkdir()
        (project_dir / "docs").mkdir()

        # Create files based on template
        if args.template == 'basic':
            (project_dir / "README.md").write_text(f"# {args.name}\n\n")
            (project_dir / "requirements.txt").write_text("")

        print(f"{Colors.GREEN}✓ Initialized project: {args.name}{Colors.RESET}")
        print(f"  Location: {project_dir}")
        print(f"  Template: {args.template}")

        return 0

    except Exception as e:
        logger.error(f"Initialization failed: {e}")
        print(f"{Colors.RED}✗ Initialization failed: {e}{Colors.RESET}")
        return 1


def cmd_build(args: argparse.Namespace) -> int:
    """
    Build the project.

    Args:
        args: Parsed command-line arguments

    Returns:
        Exit code
    """
    mode = "release" if args.release else "debug"
    logger.info(f"Building project in {mode} mode")

    try:
        # TODO: Implement build logic
        output_dir = args.output or Path.cwd() / "build" / mode
        output_dir.mkdir(parents=True, exist_ok=True)

        logger.info("Running build steps...")
        # Add your build steps here

        print(f"{Colors.GREEN}✓ Build completed{Colors.RESET}")
        print(f"  Mode: {mode}")
        print(f"  Output: {output_dir}")

        return 0

    except Exception as e:
        logger.error(f"Build failed: {e}")
        print(f"{Colors.RED}✗ Build failed: {e}{Colors.RESET}")
        return 1


def cmd_deploy(args: argparse.Namespace) -> int:
    """
    Deploy the project.

    Args:
        args: Parsed command-line arguments

    Returns:
        Exit code
    """
    logger.info(f"Deploying to {args.env} environment")

    if args.dry_run:
        print(f"{Colors.YELLOW}⚠ DRY RUN - No changes will be made{Colors.RESET}")

    try:
        # TODO: Implement deployment logic

        if args.dry_run:
            print(f"{Colors.BLUE}Would deploy to: {args.env}{Colors.RESET}")
        else:
            print(f"{Colors.GREEN}✓ Deployed to {args.env}{Colors.RESET}")

        return 0

    except Exception as e:
        logger.error(f"Deployment failed: {e}")
        print(f"{Colors.RED}✗ Deployment failed: {e}{Colors.RESET}")
        return 1


def cmd_status(args: argparse.Namespace) -> int:
    """
    Show project status.

    Args:
        args: Parsed command-line arguments

    Returns:
        Exit code
    """
    logger.info("Fetching project status")

    try:
        # TODO: Gather status information

        if args.format == 'text':
            print("Project Status")
            print("=" * 40)
            print(f"Directory: {Path.cwd()}")
            print(f"Status: {Colors.GREEN}OK{Colors.RESET}")

        elif args.format == 'json':
            import json
            status = {
                "directory": str(Path.cwd()),
                "status": "ok"
            }
            print(json.dumps(status, indent=2))

        elif args.format == 'yaml':
            import yaml
            status = {
                "directory": str(Path.cwd()),
                "status": "ok"
            }
            print(yaml.dump(status, default_flow_style=False))

        return 0

    except Exception as e:
        logger.error(f"Failed to get status: {e}")
        print(f"{Colors.RED}✗ Failed to get status: {e}{Colors.RESET}")
        return 1


def main() -> int:
    """
    Main entry point.

    Returns:
        Exit code
    """
    parser = create_parser()
    args = parser.parse_args()

    # Configure logging
    if args.verbose:
        logger.setLevel(logging.DEBUG)
        logger.debug("Debug logging enabled")

    # Route to command handler
    try:
        if args.command == 'init':
            return cmd_init(args)
        elif args.command == 'build':
            return cmd_build(args)
        elif args.command == 'deploy':
            return cmd_deploy(args)
        elif args.command == 'status':
            return cmd_status(args)
        else:
            logger.error(f"Unknown command: {args.command}")
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
