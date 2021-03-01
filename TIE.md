# Pull the latest release of upstream into the fork (you need to be admin)
* fetch upstream `git fetch upstream`
* checkout master `git checkout -b master origin/master`
* consider squashing tie-changes if there are several to reduce conflict resolving steps
* rebase master to the latest release-tag of upstream (e.g. `git rebase upstream/master`)
* resolve merge-conflicts
* push master `git push -f origin master`

# Make new changes
* Create feature Branch checkout a new branch
* add changes
* make a pull-request to merge your branch into master
# Create new release
* create a new branch named `release/<version>` (e.g. `release/0.27.0-1`) and push it to Github
* Build Release 'yarn install' and 'yarn build'
* login to nexus with `npm --registry="http://dev-repository.tie.local:8081/repository/npm-hosted/" login`
* Publish with `npm --registry="http://dev-repository.tie.local:8081/repository/npm-hosted/" publish`
# Patch an existing release
* checkout the release-branch you need to patch
* bump tie-version in [package.json](package.json) (e.g. `0.27.0-1`)
* make your changes and commit a new change
* build and publish release like described above
