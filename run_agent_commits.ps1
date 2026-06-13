# Run modular agent commits safely
param()
$repoRoot = Split-Path -Path $MyInvocation.MyCommand.Definition -Parent
Set-Location $repoRoot
Write-Host "Repo root: $repoRoot"

# Ensure we're on branch twinkle
$currentBranch = git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne 'twinkle') {
    Write-Host "Switching to branch 'twinkle'"
    git checkout twinkle 2>$null -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -ne 0) {
        git checkout -b twinkle
    }
}

$commits = @(
    @{ files = @('server/src/models/agentDecisionLog.model.js','server/src/models/threatMemory.model.js'); msg = 'feat(agent): add AgentDecisionLog and ThreatMemory models' },
    @{ files = @(
            'server/src/agents/orchestrator.agent.js',
            'server/src/agents/decision.agent.js',
            'server/src/agents/executor.agent.js',
            'server/src/agents/memory.agent.js',
            'server/src/agents/perception.agent.js',
            'server/src/agents/confidenceCascade.agent.js'
        ); msg = 'feat(agent): implement orchestrator, decision, executor, memory, perception and confidence cascade' },
    @{ files = @(
            'server/src/services/agent.service.js',
            'server/src/controllers/agent.controller.js',
            'server/src/routes/agent.route.js',
            'server/src/config/socket.js'
        ); msg = 'feat(api): add agent routes, controller, service and socket emitter' },
    @{ files = @(
            'server/src/scripts/test_agent_models.js',
            'server/src/scripts/run_decision_test.js',
            'server/src/scripts/run_orchestrator_test.js',
            'ml-service/app/main.py',
            'ml-service/ai/severity_classifier.py'
        ); msg = 'test(agent): add model/decision/orchestrator test scripts; add ML classifier endpoint' },
    @{ files = @(
            'server/src/models/organization.model.js',
            'server/src/services/agent.service.js',
            'server/src/services/scans.service.js',
            'server/src/jobs/scan.job.js',
            'server/src/routes/index.js',
            'server/package-lock.json',
            'ml-service/app/main.py',
            'server/src/config/socket.js'
        ); msg = 'fix: remove duplicate index and small agent.service fixes; wire agents into pipeline' }
)

foreach ($c in $commits) {
    Write-Host "\n---\nCommitting: $($c.msg)"
    $addedAny = $false
    foreach ($f in $c.files) {
        if (Test-Path $f) {
            git add $f
            if ($LASTEXITCODE -eq 0) { $addedAny = $true; Write-Host "Staged: $f" }
        } else {
            Write-Host "WARN: Missing file, skipping: $f"
        }
    }
    if ($addedAny) {
        $staged = git diff --cached --name-only
        if ($staged) {
            git commit -m "$($c.msg)"
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Committed: $($c.msg)"
            } else {
                Write-Host "ERROR: commit failed for: $($c.msg)"; exit 1
            }
        } else {
            Write-Host "No staged changes for this commit. Skipping commit."
        }
    } else {
        Write-Host "No files staged for this step. Skipping commit."
    }
}

Write-Host "\nFinal git status:"; git status --porcelain
Write-Host "\nRecent commits:"; git log --oneline -n 15
Write-Host "\nScript complete. Run 'git push origin twinkle' to push when ready."