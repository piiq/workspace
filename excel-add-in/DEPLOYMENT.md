# Deploying the OpenBB Add-in for Excel On-Premise

## Guidelines for OpenBB Add-in Developer

Configure the add-in for the deployment domain, then build and deliver it:

| Step                         | Action                                                        | Details                                                                                              |
| :--------------------------- | :------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------- |
| 1. Hosting URL | Set `ADDIN_BASE_URL` | Add-in hosting URL, such as `https://client-domain.com`. |
| 2. Backend URL | Set `VITE_BACKEND_URL` | Workspace backend URL. |
| 3. Add-in ID | Set `ADDIN_UUID` | Unique UUID for this deployment. |
| 4. Build | `npm run build` | Output is in `dist/`. URL settings are fixed at build time. |
| 5. Validate | `npm run validate` | Check `manifest.xml`. |
| 6. Deliver | Send `dist/` | Include the web files and `manifest.xml`. |

## Guide for Client Organization Administrator

Host the built application and distribute its manifest through Microsoft 365.

Prerequisites.

- The client should have the infrastructure to host the OpenBB add-in for Excel application (minified static html/js/css bundle)
- The client should have all necessary backend services (e.g., the OpenBB Workspace application) deployed on their own infrastructure.
- The client should provide 2 URLs to the add-in developer:
  - The URL for the resource where the Add-in will be served from
  - The URL of the OpenBB Workspace backend
- The add-in developer must provide a customized application bundle, including the `manifest.xml` file, configured with the client's hosted domain.

Deployment Steps.

1. Obtain Customized Files: Receive the built bundle and `manifest.xml` from the add-in developer.
2. Host the Application: Host the application bundle (the front-end code) on the client's chosen domain. This domain should match the `ADDIN_BASE_URL` configured in the manifest.
3. Access Admin Center: Log in to the organization's Microsoft 365 Admin Center.
4. Navigate to Integrated Apps: Go to the section for Integrated Apps (or equivalent for managing custom add-ins).
5. Upload Custom App: Select the option to Upload Custom App.
6. Upload Manifest: Upload the customized `manifest.xml` file from the build.
7. Deploy to Users: Follow the prompts to deploy the add-in to the desired user groups or the entire organization.

## Release

Run the [function generator](README.md#generate-custom-functions--integration-tests) when function declarations change, run [integration tests](README.md#integration-tests), and update the [function documentation](README.md#documentation).

For Microsoft AppSource distribution, increment the package version with `npm version patch`, build and validate the package using the steps above, and submit its generated `dist/manifest.xml` through Microsoft Partner Center.

For organization deployments, distribute the built files and update the manifest in the organization's Microsoft 365 Admin Center under Integrated Apps.
