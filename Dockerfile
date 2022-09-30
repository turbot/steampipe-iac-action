FROM turbot/steampipe

# Setup prerequisites (as root)
USER root:0
RUN apt-get update -y \
 && apt-get install -y git

# Install the aws and steampipe plugins for Steampipe (as steampipe user).
USER steampipe:0
RUN  steampipe plugin install steampipe aws

# A mod may be installed to a working directory
RUN  git clone --depth 1 https://github.com/turbot/steampipe-mod-aws-compliance.git /workspace
WORKDIR /workspace

# Code file to execute when the docker container starts up (`entrypoint.sh`)
ENTRYPOINT ["./entrypoint.sh"]