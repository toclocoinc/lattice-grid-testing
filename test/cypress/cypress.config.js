// Contract tests under the Cypress binding, in real Chrome against the
// published grid. The fixture server is the package's own test/server.js,
// started when Cypress loads this config.
import { defineConfig } from 'cypress';
import { startServer } from '../server.js';

export default defineConfig({
  video: false,
  screenshotOnRunFailure: false,
  viewportWidth: 1100,
  viewportHeight: 900,
  e2e: {
    specPattern: 'e2e/**/*.cy.js',
    supportFile: false,
    /**
     * Starts the fixture server and points baseUrl at it.
     * @param {Cypress.PluginEvents} on The event registrar.
     * @param {Cypress.PluginConfigOptions} config The resolved config.
     * @returns {Promise<Cypress.PluginConfigOptions>} The config with baseUrl set.
     */
    async setupNodeEvents(on, config) {
      const { url, close } = await startServer(4792);
      on('after:run', () => close());
      return { ...config, baseUrl: url };
    },
  },
});
