// vars/notify.groovy
//
// Slack / Teams / etc. notification. Reads a webhook URL from a mounted
// secret at /tmp/slack/url; skips silently if missing. Builds the payload
// with jq so any character in the error message is escaped correctly.
//
// Usage:  notify(cfg + [status: 'SUCCESS'|'FAILURE'])
//   cfg.image (optional)        default "${registry}/${org}/${image}:${VERSION}"

def call(Map cfg = [:]) {
    def status = cfg.status ?: 'UNKNOWN'
    def color  = status == 'SUCCESS' ? 'good' : status == 'FAILURE' ? 'danger' : '#999'
    def title  = "${status} — ${cfg.image ?: env.JOB_NAME}"
    def text   = status == 'SUCCESS'
        ? "Image: `${cfg.registry}/${cfg.org}/${cfg.image}:${env.VERSION}`"
        : "Stage: `${env.CURRENT_STAGE ?: 'unknown'}`\nConsole: <${env.BUILD_URL}console|open log>"

    container('tools') {
        withEnv([
            "N_COLOR=${color}", "N_TITLE=${title}", "N_TITLE_LINK=${env.BUILD_URL}",
            "N_TEXT=${text}",   "N_BUILD=${env.BUILD_NUMBER}",
        ]) {
            sh '''
                if [ ! -f /tmp/slack/url ]; then echo "(no webhook configured)"; exit 0; fi
                jq -n \
                    --arg c "$N_COLOR" --arg t "$N_TITLE" --arg l "$N_TITLE_LINK" \
                    --arg x "$N_TEXT"  --arg b "$N_BUILD" \
                    '{attachments:[{color:$c,title:$t,title_link:$l,text:$x,
                       fields:[{title:"Build",value:$b,short:true}]}]}' > /tmp/payload.json
                curl -sS -X POST -H 'Content-Type: application/json' \
                    --data @/tmp/payload.json "$(cat /tmp/slack/url)" >/dev/null || true
            '''
        }
    }
}
