# Place at the repository root as `.tflint.hcl`.
# After editing, run `tflint --init` to download / update plugin binaries.

plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

# Enable only the providers your repo uses. Comment out the rest.

# AWS
plugin "aws" {
  enabled = true
  version = "0.32.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

# Azure
plugin "azurerm" {
  enabled = true
  version = "0.27.0"
  source  = "github.com/terraform-linters/tflint-ruleset-azurerm"
}

# GCP
plugin "google" {
  enabled = true
  version = "0.30.0"
  source  = "github.com/terraform-linters/tflint-ruleset-google"
}

# Naming convention enforcement
rule "terraform_naming_convention" {
  enabled = true

  variable {
    format = "snake_case"
  }
  output {
    format = "snake_case"
  }
  resource {
    format = "snake_case"
  }
  module {
    format = "snake_case"
  }
}

rule "terraform_required_version" {
  enabled = true
}

rule "terraform_required_providers" {
  enabled = true
}

rule "terraform_unused_declarations" {
  enabled = true
}

rule "terraform_documented_outputs" {
  enabled = true
}

rule "terraform_documented_variables" {
  enabled = true
}

rule "terraform_typed_variables" {
  enabled = true
}
