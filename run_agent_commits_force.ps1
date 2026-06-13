Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Path $MyInvocation.MyCommand.Definition -Parent
Set-Location $repoRoot
Write-Host "Repo root: $repoRoot"

# Ensure branch twinkle
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne 'twinkle') {
    Write-Host "Switching to 'twinkle'"
    git checkout twinkle 2>$null
    if ($LASTEXITCODE -ne 0) { git checkout -b twinkle }
}

$groups = @(
    @{ Files = @('server/src/agents/orchestrator.agent.js','server/src/agents/decision.agent.js','server/src/agents/executor.agent.js','server/src/agents/memory.agent.js','server/src/agents/perception.agent.js','server/src/agents/confidenceCascade.agent.js'); Msg = 'feat(agent): implement orchestrator, decision, executor, memory, perception and confidence cascade' },
    @{ Files = @('server/src/services/agent.service.js','server/src/controllers/agent.controller.js','server/src/routes/agent.route.js','server/src/config/socket.js'); Msg = 'feat(api): add agent routes, controller, service and socket emitter' },
    @{ Files = @('server/src/scripts/test_agent_models.js','server/src/scripts/run_decision_test.js','server/src/scripts/run_orchestrator_test.js','ml-service/app/main.py','ml-service/ai/severity_classifier.py'); Msg = 'test(agent): add model/decision/orchestrator test scripts; add ML classifier endpoint' },
    @{ Files = @('server/src/models/organization.model.js','server/src/services/agent.service.js','server/src/services/scans.service.js','server/src/jobs/scan.job.js','server/src/routes/index.js','server/package-lock.json','ml-service/app/main.py','server/src/config/socket.js'); Msg = 'fix: remove duplicate index and small agent.service fixes; wire agents into pipeline' }
)

foreach ($group in $groups) {
    Write-Host "\n---\nProcessing: $($group.Msg)"
    $anyAdded = $false
    foreach ($file in $group.Files) {
        if (Test-Path $file) {
            git add -- $file
            $anyAdded = $true
            Write-Host "Added: $file"
        } else {
            Write-Host "Missing: $file"
        }
    }
    $staged = (git diff --cached --name-only) -join "`n"
    if (-not [string]::IsNullOrWhiteSpace($staged)) {
        Write-Host "Staged files:`n$staged"
        git commit -m "$($group.Msg)"
        if ($LASTEXITCODE -ne 0) { Write-Host "Commit failed for: $($group.Msg)" }
    } else {
        Write-Host "No staged changes for this group."
    }
}

# Commit helper scripts if present
$helpers = @('run_agent_commits.ps1','run_agent_commits_force.ps1')
foreach ($h in $helpers) {
    if (Test-Path $h) {
        git add -- $h
        $staged = (git diff --cached --name-only) -join "`n"
        if (-not [string]::IsNullOrWhiteSpace($staged)) {
            git commit -m "chore(scripts): add $h"
        } else {
            Write-Host "$h has no staged changes or is already tracked."
        }
    }
}

Write-Host "\nFinal status:"; git status --porcelain
Write-Host "\nRecent commits:"; git log --oneline -n 20
Write-Host "\nDone. Run 'git push origin twinkle' when ready."