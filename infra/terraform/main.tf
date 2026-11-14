# Option B from the course (PaaS): Render runs the Docker image, Neon hosts Postgres.
# Building blocks stay the same as on GCP: container service + managed Postgres + secrets.

resource "neon_project" "db" {
  name      = var.app_name
  region_id = "aws-eu-central-1" # Frankfurt, closest to Lviv
}

resource "render_web_service" "app" {
  name   = var.app_name
  plan   = var.render_plan
  region = "frankfurt"

  runtime_source = {
    docker = {
      repo_url        = var.repo_url
      branch          = var.branch
      dockerfile_path = "./Dockerfile"
      context         = "."
      # CI deploys after tests pass (GitHub Actions -> deploy hook), not on every push.
      auto_deploy = false
    }
  }

  health_check_path = "/api/health"

  env_vars = {
    DATABASE_URL        = { value = neon_project.db.connection_uri }
    AUTH_PROVIDER       = { value = "firebase" }
    FIREBASE_PROJECT_ID = { value = var.firebase_project_id }
  }
}
