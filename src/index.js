const fs = require('fs');
const sgClient = require('@sendgrid/client');

const TEMPLATE_DIR = 'templates';
const TEMPLATE_MAP_FILENAME = `${TEMPLATE_DIR}/templateLookup.json`;

sgClient.setApiKey(process.env.SENDGRID_API_KEY);

function getTemplates() {
  const reqData = {
    method: 'GET',
    url: '/v3/templates',
    qs: {
      generations: 'dynamic',
      page_size: 200,
    },
  };
  return sgClient.request(reqData);
}

function getTemplate(templateId) {
  const reqData = {
    method: 'GET',
    url: `/v3/templates/${templateId}`,
  };
  return sgClient.request(reqData);
}

function readTemplateLookupFromFile() {
  if (!fs.existsSync(TEMPLATE_MAP_FILENAME)) {
    console.log(
      `No template mapping definition found at ${TEMPLATE_MAP_FILENAME}`,
    );
    return {};
  }
  return JSON.parse(fs.readFileSync(TEMPLATE_MAP_FILENAME));
}

function readTemplateFromFile(templateId) {
  const htmlFilename = `${TEMPLATE_DIR}/${templateId}/.html`;
  return new Promise(function (resolve, reject) {
    fs.readFile(htmlFilename, 'utf8', function (err, htmlData) {
      err ? reject(err) : resolve(htmlData);
    });
  });
}

function sendTestEmail(templateId) {
  const reqBody = {
    personalizations: [
      {
        to: [
          {
            email: 'jeff.israel@gmail.com',
          },
        ],
        dynamic_template_data: {
          firstName: 'Jeff',
          subject: "Let's get SengGrid working!",
        },
      },
    ],
    from: {
      email: 'info@jvolpe.com',
    },
    template_id: templateId,
  };

  const reqData = {
    body: reqBody,
    method: 'POST',
    url: '/v3/mail/send',
  };
  return sgClient.request(reqData);
}

function updateTemplateVersion(templateId, versionId, templateVersionData) {
  const reqData = {
    body: templateVersionData,
    method: 'PATCH',
    url: `/v3/templates/${templateId}/versions/${versionId}`,
  };
  return sgClient.request(reqData);
}

function writeTemplateLookupToFile(templateLookup) {
  fs.writeFileSync(
    TEMPLATE_MAP_FILENAME,
    JSON.stringify(templateLookup, '\n', '  '),
  );
}

function writeTemplateVersionsToFile(templateId) {
  const templateDir = `${TEMPLATE_DIR}/${templateId}`;

  if (!fs.existsSync(templateDir)) {
    fs.mkdirSync(templateDir);
  }

  return getTemplate(templateId).then(([response, body]) => {
    return body.versions.map((templateVersion) => {
      const htmlFilename = `${templateDir}/${templateVersion.id}.html`;
      fs.writeFileSync(htmlFilename, templateVersion.html_content);
      return htmlFilename;
    });
  });
}

/*
- load template lookup
- get all templates
- for each template:
  - if template directory does not exist:
    - create it
    - add template to lookup
  - for each template version:
    - if the template version file does not exist, create it
    - if date/time modified is later than what is in the lookup, update it
*/

const templateLookup = readTemplateLookupFromFile();
const updateQueue = [];

fs.existsSync(TEMPLATE_DIR) || fs.mkdirSync(TEMPLATE_DIR);

getTemplates()
  .then(([response, body]) => {
    const sgTemplateList = body.result;
    console.log(JSON.stringify(sgTemplateList, '\n', '  '));

    sgTemplateList.forEach((sgTemplate) => {
      if (!templateLookup.hasOwnProperty(sgTemplate.id)) {
        console.debug(`Adding template ${sgTemplate.id} to lookup.`);
        templateLookup[sgTemplate.id] = {
          name: sgTemplate.name,
          versions: {},
        };
      }

      sgTemplate.versions.forEach((sgTemplateVersion) => {
        if (
          !templateLookup[sgTemplate.id].hasOwnProperty(sgTemplateVersion.id)
        ) {
          console.debug(
            `Adding version ${sgTemplateVersion.id} of template ${sgTemplate.id} to lookup.`,
          );
          templateLookup[sgTemplate.id][sgTemplateVersion.id] = {
            name: sgTemplateVersion.name,
            active: sgTemplateVersion.active,
            lastUpdated: sgTemplateVersion.updated_at,
          };
          updateQueue.push({
            templateId: sgTemplate.id,
            versionId: sgTemplateVersion.id,
          });
        }
      });
    });

    return Promise.all(
      updateQueue.map((templateUpdate) =>
        writeTemplateVersionsToFile(templateUpdate.templateId),
      ),
    );

  })
  .then(([filesWritten]) => {
    console.log(filesWritten);
    writeTemplateLookupToFile(templateLookup);
  })
  .catch((err) => console.error(err));
