// vars/lintAndTest.groovy
//
// Runs the project's lint + test suite using the package manager that
// matches the lockfile. Detection rules match references/discovery.md
// in the information-architecture skill.
//
// Lockfile-wins ordering: pnpm > bun > yarn > npm > uv > poetry > pdm >
// pipenv > pip-only > go > cargo > bundler.
//
// Usage:  lintAndTest()

def call() {
    container('tools') {
        sh '''
            set -e
            if   [ -f pnpm-lock.yaml ];      then pnpm install --frozen-lockfile && pnpm test
            elif [ -f bun.lock ] || [ -f bun.lockb ]; then bun install --frozen-lockfile && bun test
            elif [ -f yarn.lock ];           then yarn install --frozen-lockfile && yarn test
            elif [ -f package-lock.json ];   then npm ci && npm test
            elif [ -f uv.lock ];             then uv sync --frozen && uv run pytest
            elif [ -f poetry.lock ];         then poetry install --no-root && poetry run pytest
            elif [ -f pdm.lock ];            then pdm install --frozen-lockfile && pdm run pytest
            elif [ -f Pipfile.lock ];        then pipenv sync --dev && pipenv run pytest
            elif [ -f requirements.txt ];    then pip install -r requirements.txt && pytest
            elif [ -f go.sum ];              then go test -coverprofile=coverage.out ./...
            elif [ -f Cargo.lock ];          then cargo test
            elif [ -f Gemfile.lock ];        then bundle install && bundle exec rspec
            else echo "No recognised lockfile — skipping lint/test stage" ; fi
        '''
    }
}
