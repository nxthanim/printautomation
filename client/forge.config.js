module.exports = {
  packagerConfig: {
    name: 'PrintAutomationClient',
    executableName: 'PrintAutomationClient',
    extraResource: ['tools/SumatraPDF.exe'],
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: { name: 'PrintAutomationClient', setupExe: 'PrintAutomationClient_Setup.exe' },
    },
  ],
};
