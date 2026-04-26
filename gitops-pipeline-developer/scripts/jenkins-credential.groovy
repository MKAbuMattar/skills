// jenkins-credential.groovy
//
// Generic Jenkins credential creator. Idempotent — re-running upgrades the
// credential body in place rather than duplicating it. Run via the Jenkins
// Script Console (or curl /scriptText). Read the parameters from
// /tmp/jenkins-credential.params (a key=value file written by the wrapper).
//
// Supported credential types:
//   ssh-key        — BasicSSHUserPrivateKey (key file at /tmp/<id>.key)
//   secret-text    — StringCredentialsImpl  (value at /tmp/<id>.value)
//   username-pass  — UsernamePasswordCredentialsImpl (user + value)

import com.cloudbees.jenkins.plugins.sshcredentials.impl.BasicSSHUserPrivateKey
import com.cloudbees.plugins.credentials.CredentialsScope
import com.cloudbees.plugins.credentials.SystemCredentialsProvider
import com.cloudbees.plugins.credentials.domains.Domain
import com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl
import org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl
import hudson.util.Secret

def params = [:]
new File('/tmp/jenkins-credential.params').eachLine { line ->
    if (line && !line.startsWith('#')) {
        def (k, v) = line.split('=', 2)
        params[k.trim()] = v.trim()
    }
}

def id          = params.id          ?: { throw new IllegalArgumentException('id required') }()
def kind        = params.kind        ?: 'ssh-key'
def description = params.description ?: ''
def username    = params.username    ?: 'git'

def store    = SystemCredentialsProvider.getInstance().getStore()
def domain   = Domain.global()
def existing = com.cloudbees.plugins.credentials.CredentialsProvider
                 .lookupCredentials(com.cloudbees.plugins.credentials.common.StandardCredentials.class)
                 .find { it.id == id }

def cred = null
switch (kind) {
    case 'ssh-key':
        def keyText = new File("/tmp/${id}.key").text
        cred = new BasicSSHUserPrivateKey(
            CredentialsScope.GLOBAL, id, username,
            new BasicSSHUserPrivateKey.DirectEntryPrivateKeySource(keyText),
            params.passphrase ?: '', description
        )
        break
    case 'secret-text':
        def value = new File("/tmp/${id}.value").text.trim()
        cred = new StringCredentialsImpl(CredentialsScope.GLOBAL, id, description, Secret.fromString(value))
        break
    case 'username-pass':
        def password = new File("/tmp/${id}.value").text.trim()
        cred = new UsernamePasswordCredentialsImpl(CredentialsScope.GLOBAL, id, description, username, password)
        break
    default:
        throw new IllegalArgumentException("Unknown kind: ${kind}")
}

if (existing) {
    store.updateCredentials(domain, existing, cred)
    println "Credential ${id} updated (kind=${kind})"
} else {
    store.addCredentials(domain, cred)
    println "Credential ${id} created (kind=${kind})"
}
