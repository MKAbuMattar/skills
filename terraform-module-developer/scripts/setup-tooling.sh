#!/usr/bin/env bash
# Install the terraform-module-developer toolchain on the local machine.
#
# Installs (if missing):
#   - terraform   (HashiCorp)
#   - terraform-docs
#   - tflint
#   - tfsec / trivy
#   - checkov
#   - pre-commit
#
# Detects the OS package manager (brew on macOS, apt/yum/dnf on Linux) and uses
# the most idiomatic install path. Falls back to a curl + tar binary install.

set -euo pipefail

if [[ -t 1 ]]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; BLUE=$'\033[0;34m'; NC=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

info() { printf '%s%s%s\n' "$BLUE" "$1" "$NC"; }
ok() { printf '%s✓%s %s\n' "$GREEN" "$NC" "$1"; }
warn() { printf '%s⚠%s %s\n' "$YELLOW" "$NC" "$1"; }

# Detect OS
case "$(uname -s)" in
  Darwin) OS="macos" ;;
  Linux)  OS="linux" ;;
  *)      OS="unknown" ;;
esac

# Detect package manager
PKG_MGR="none"
if [[ "$OS" == "macos" ]] && command -v brew >/dev/null 2>&1; then
  PKG_MGR="brew"
elif [[ "$OS" == "linux" ]]; then
  if command -v apt-get >/dev/null 2>&1; then
    PKG_MGR="apt"
  elif command -v dnf >/dev/null 2>&1; then
    PKG_MGR="dnf"
  elif command -v yum >/dev/null 2>&1; then
    PKG_MGR="yum"
  elif command -v pacman >/dev/null 2>&1; then
    PKG_MGR="pacman"
  fi
fi

info "OS: $OS, package manager: $PKG_MGR"

have() { command -v "$1" >/dev/null 2>&1; }

install_terraform() {
  if have terraform; then ok "terraform: $(terraform version | head -1)"; return; fi
  case "$PKG_MGR" in
    brew)
      brew tap hashicorp/tap 2>/dev/null || true
      brew install hashicorp/tap/terraform
      ;;
    apt)
      sudo apt-get update
      sudo apt-get install -y gnupg software-properties-common curl
      curl -fsSL https://apt.releases.hashicorp.com/gpg \
        | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
      echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
        | sudo tee /etc/apt/sources.list.d/hashicorp.list
      sudo apt-get update && sudo apt-get install -y terraform
      ;;
    dnf|yum)
      sudo "$PKG_MGR" install -y dnf-plugins-core || true
      sudo "$PKG_MGR" config-manager --add-repo https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo
      sudo "$PKG_MGR" install -y terraform
      ;;
    pacman)
      sudo pacman -S --needed --noconfirm terraform
      ;;
    *)
      warn "no package manager — see https://developer.hashicorp.com/terraform/install"
      return 1
      ;;
  esac
  ok "terraform installed: $(terraform version | head -1)"
}

install_terraform_docs() {
  if have terraform-docs; then ok "terraform-docs: $(terraform-docs --version)"; return; fi
  case "$PKG_MGR" in
    brew)
      brew install terraform-docs
      ;;
    *)
      VERSION="v0.19.0"
      ARCH="$(uname -m)"
      case "$ARCH" in x86_64) ARCH="amd64" ;; aarch64|arm64) ARCH="arm64" ;; esac
      URL="https://github.com/terraform-docs/terraform-docs/releases/download/${VERSION}/terraform-docs-${VERSION}-${OS}-${ARCH}.tar.gz"
      info "downloading terraform-docs from $URL"
      tmp="$(mktemp -d)"
      curl -fsSL "$URL" -o "$tmp/terraform-docs.tar.gz"
      tar -xzf "$tmp/terraform-docs.tar.gz" -C "$tmp"
      sudo install -m 0755 "$tmp/terraform-docs" /usr/local/bin/terraform-docs
      rm -rf "$tmp"
      ;;
  esac
  ok "terraform-docs installed: $(terraform-docs --version)"
}

install_tflint() {
  if have tflint; then ok "tflint: $(tflint --version | head -1)"; return; fi
  case "$PKG_MGR" in
    brew)
      brew install tflint
      ;;
    *)
      curl -fsSL https://raw.githubusercontent.com/terraform-linters/tflint/master/install_linux.sh | bash
      ;;
  esac
  ok "tflint installed: $(tflint --version | head -1)"
}

install_tfsec_or_trivy() {
  # Prefer trivy (modern successor to tfsec). Fall back to tfsec if trivy install fails.
  if have trivy; then ok "trivy: $(trivy --version | head -1)"; return; fi
  if have tfsec; then ok "tfsec: $(tfsec --version)"; return; fi

  case "$PKG_MGR" in
    brew)
      brew install trivy
      ;;
    apt)
      sudo apt-get install -y wget gnupg
      wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
      echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" \
        | sudo tee -a /etc/apt/sources.list.d/trivy.list
      sudo apt-get update && sudo apt-get install -y trivy
      ;;
    dnf|yum)
      cat <<'EOF' | sudo tee /etc/yum.repos.d/trivy.repo >/dev/null
[trivy]
name=Trivy repository
baseurl=https://aquasecurity.github.io/trivy-repo/rpm/releases/$basearch/
gpgcheck=1
enabled=1
gpgkey=https://aquasecurity.github.io/trivy-repo/rpm/public.key
EOF
      sudo "$PKG_MGR" install -y trivy
      ;;
    *)
      warn "no package manager for trivy — falling back to tfsec via curl"
      curl -fsSL https://raw.githubusercontent.com/aquasecurity/tfsec/master/scripts/install_linux.sh | bash
      ;;
  esac
  ok "trivy/tfsec installed"
}

install_checkov() {
  if have checkov; then ok "checkov: $(checkov --version)"; return; fi
  if have pipx; then
    pipx install checkov
  elif have pip3; then
    pip3 install --user checkov
  elif [[ "$PKG_MGR" == "brew" ]]; then
    brew install checkov
  else
    warn "no pipx / pip3 / brew — install Python first, then: pipx install checkov"
    return 1
  fi
  ok "checkov installed"
}

install_pre_commit() {
  if have pre-commit; then ok "pre-commit: $(pre-commit --version)"; return; fi
  if have pipx; then
    pipx install pre-commit
  elif have pip3; then
    pip3 install --user pre-commit
  elif [[ "$PKG_MGR" == "brew" ]]; then
    brew install pre-commit
  else
    warn "no pipx / pip3 / brew — install Python first, then: pipx install pre-commit"
    return 1
  fi
  ok "pre-commit installed"
}

info "installing terraform-module-developer toolchain"
echo

install_terraform || warn "terraform install failed (continuing)"
install_terraform_docs || warn "terraform-docs install failed (continuing)"
install_tflint || warn "tflint install failed (continuing)"
install_tfsec_or_trivy || warn "trivy/tfsec install failed (continuing)"
install_checkov || warn "checkov install failed (continuing)"
install_pre_commit || warn "pre-commit install failed (continuing)"

echo
ok "toolchain installation complete"
cat <<EOF

${YELLOW}Next steps:${NC}
  1. From your Terraform repo root, copy the config templates:
     cp <skill>/assets/templates/configs/terraform-docs.yml ./.terraform-docs.yml
     cp <skill>/assets/templates/configs/tflint.hcl         ./.tflint.hcl
     cp <skill>/assets/templates/configs/editorconfig       ./.editorconfig

  2. Wire the pre-commit hooks (see assets/templates/configs/pre-commit-fragment.yaml).

  3. Initialize tflint plugins: tflint --init

  4. Scaffold a module: bash <skill>/scripts/scaffold-module.sh <service> <resource> <provider>
EOF
