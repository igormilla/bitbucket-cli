const {execSync} = require('child_process');


class git {
    static getCurrentBranch() {
        try{
            const output = execSync('git rev-parse --abbrev-ref HEAD');
            return output.toString().trim();
        }catch(e){
            return null;
        }        
    }
    static getCurrentBitbucketSlug() {
        try{
            const output = execSync('git config --get remote.origin.url');
            const remoteUrl = output.toString().trim();
            const slug = remoteUrl.split('/')[1].split('.')[0];
            return slug;
        }catch (e){
            return null;
        }
        
    }
}
module.exports = git;
