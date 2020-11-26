const fs = require('fs');
const sgClient = require('@sendgrid/client');

const TEMPLATES_DIR = 'templates';
const TEMPLATE_LOOKUP_FILENAME = `${TEMPLATES_DIR}/templateLookup.json`;

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
  if (!fs.existsSync(TEMPLATE_LOOKUP_FILENAME)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(TEMPLATE_LOOKUP_FILENAME));
}

function readTemplateFromFile(templateId) {
  const htmlFilename = `${TEMPLATES_DIR}/${templateId}/.html`;
  return new Promise((resolve, reject) => {
    fs.readFile(htmlFilename, 'utf8', (err, htmlData) => {
      return err ? reject(err) : resolve(htmlData);
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
    TEMPLATE_LOOKUP_FILENAME,
    JSON.stringify(templateLookup, '\n', '  '),
  );
}

async function writeTemplateVersionsToFile(templateId, versionsToUpdate) {
  const templateDir = `${TEMPLATES_DIR}/${templateId}`;
  if (!fs.existsSync(templateDir)) {
    fs.mkdirSync(templateDir);
  }
  return getTemplate(templateId).then(([, body]) => {
    return body.versions
      .filter((templateVersion) => {
        return versionsToUpdate.includes(templateVersion.id);
      })
      .map((templateVersion) => {
        const htmlFilename = `${templateDir}/${templateVersion.id}.html`;
        fs.writeFileSync(htmlFilename, templateVersion.html_content);
        return htmlFilename;
      });
  });
}

if (!fs.existsSync(TEMPLATES_DIR)) {
  fs.mkdirSync(TEMPLATES_DIR);
}

// TODO: fetch existing lookup
const templateLookup = readTemplateLookupFromFile();
const templateUpdates = {};

getTemplates()
  .then(([, body]) => {
    const sgTemplateList = body.result;

    sgTemplateList.forEach((sgTemplate) => {
      if (!(sgTemplate.id in templateLookup)) {
        templateLookup[sgTemplate.id] = {
          name: sgTemplate.name,
          versions: {},
        };
      }

      sgTemplate.versions.forEach((sgTemplateVersion) => {
        const newVersion = !(
          sgTemplateVersion.id in templateLookup[sgTemplate.id].versions
        );

        if (newVersion) {
          templateLookup[sgTemplate.id].versions[sgTemplateVersion.id] = {
            name: sgTemplateVersion.name,
            active: sgTemplateVersion.active,
            lastUpdated: sgTemplateVersion.updated_at,
          };
        }

        const lastUpdatedApi = new Date(sgTemplateVersion.updated_at);
        const lastUpdatedLocal = new Date(
          templateLookup[sgTemplate.id].versions[
            sgTemplateVersion.id
          ].lastUpdated,
        );
        const templateVersionUpdated = lastUpdatedApi > lastUpdatedLocal;
        if (newVersion || templateVersionUpdated) {
          if (!(sgTemplate.id in templateUpdates)) {
            templateUpdates[sgTemplate.id] = [];
          }
          templateUpdates[sgTemplate.id].push(sgTemplateVersion.id);
        }
      });
    });

    return Promise.all(
      Object.entries(templateUpdates).map(([templateId, templateVersions]) => {
        return writeTemplateVersionsToFile(templateId, templateVersions);
      }),
    );
  })
  .then(() => {
    writeTemplateLookupToFile(templateLookup);
  })
  .catch((err) => console.error(err));
