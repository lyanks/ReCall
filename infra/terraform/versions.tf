terraform {
  required_version = ">= 1.6"
  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.3"
    }
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.6"
    }
  }
}

# Credentials come from the environment, never from files in git:
#   RENDER_API_KEY, RENDER_OWNER_ID, NEON_API_KEY
provider "render" {}
provider "neon" {}
