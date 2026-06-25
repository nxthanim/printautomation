; Inno Setup Script for Print Automation Client
; Run with: ISCC.exe installer.iss

#define MyAppName "Print Automation Client"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Print Automation"
#define MyAppURL "https://print-automation.local"
#define MyAppExeName "PrintAutomationClient.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\PrintAutomationClient
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=installer
OutputBaseFilename=PrintAutomationClient_Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
; Main application
Source: "build\Release\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
; Qt DLLs (adjust based on your Qt installation)
Source: "C:\Qt\6.5.0\msvc2019_64\bin\Qt6Core.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "C:\Qt\6.5.0\msvc2019_64\bin\Qt6Widgets.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "C:\Qt\6.5.0\msvc2019_64\bin\Qt6Network.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "C:\Qt\6.5.0\msvc2019_64\bin\Qt6PrintSupport.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "C:\Qt\6.5.0\msvc2019_64\bin\Qt6Sql.dll"; DestDir: "{app}"; Flags: ignoreversion
; Qt SQL driver
Source: "C:\Qt\6.5.0\msvc2019_64\plugins\sqldrivers\qsqlite.dll"; DestDir: "{app}\sqldrivers"; Flags: ignoreversion
; VC++ runtime redistributable
Source: "C:\Windows\System32\vcruntime140.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "C:\Windows\System32\vcruntime140_1.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "C:\Windows\System32\msvcp140.dll"; DestDir: "{app}"; Flags: ignoreversion
; SumatraPDF
Source: "tools\SumatraPDF.exe"; DestDir: "{app}\tools"; Flags: ignoreversion
; Configuration
Source: "config.ini"; DestDir: "{app}"; Flags: ignoreversion
; CA certificate for TLS
Source: "certs\print-automation-ca.crt"; DestDir: "{app}\certs"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    if not InstallOnDemand then
    begin
      Exec('certutil', '-addstore -user Root "' + ExpandConstant('{app}') + '\certs\print-automation-ca.crt"',
        '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
  end;
end;
