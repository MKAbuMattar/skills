// jenkins-pipeline-job.groovy
//
// Generic Jenkins pipeline-job creator. Idempotent — if the job already
// exists, updates its SCM config; otherwise creates it. Reads parameters
// from /tmp/jenkins-pipeline-job.params (key=value).
//
// Required params:  jobName, repoUrl, credentialId
// Optional params:  branchSpec (default '*/main'), scriptPath (default 'Jenkinsfile')

import jenkins.model.Jenkins
import org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition
import org.jenkinsci.plugins.workflow.job.WorkflowJob
import hudson.plugins.git.BranchSpec
import hudson.plugins.git.GitSCM
import hudson.plugins.git.UserRemoteConfig

def params = [:]
new File('/tmp/jenkins-pipeline-job.params').eachLine { line ->
    if (line && !line.startsWith('#')) {
        def (k, v) = line.split('=', 2)
        params[k.trim()] = v.trim()
    }
}

def jobName       = params.jobName       ?: { throw new IllegalArgumentException('jobName required') }()
def repoUrl       = params.repoUrl       ?: { throw new IllegalArgumentException('repoUrl required') }()
def credentialId  = params.credentialId  ?: ''
def branchSpec    = params.branchSpec    ?: '*/main'
def scriptPath    = params.scriptPath    ?: 'Jenkinsfile'

def jenkins = Jenkins.instance
def existing = jenkins.getItem(jobName)
def job = existing instanceof WorkflowJob ? existing : jenkins.createProject(WorkflowJob.class, jobName)

def remote = new UserRemoteConfig(repoUrl, null, null, credentialId ?: null)
def scm    = new GitSCM([remote], [new BranchSpec(branchSpec)], null, null, [])
job.setDefinition(new CpsScmFlowDefinition(scm, scriptPath))
job.save()
jenkins.save()

println existing ? "Job '${jobName}' updated" : "Job '${jobName}' created"
