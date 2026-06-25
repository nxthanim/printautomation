#include "ConfigDialog.h"
#include "ServerClient.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QFormLayout>
#include <QPushButton>
#include <QLabel>
#include <QSettings>

ConfigDialog::ConfigDialog(ServerClient *client, QWidget *parent)
    : QDialog(parent)
    , m_client(client)
{
    setWindowTitle("Settings");
    setMinimumWidth(450);

    auto *layout = new QVBoxLayout(this);

    auto *form = new QFormLayout();
    m_serverUrlEdit = new QLineEdit();
    m_serverUrlEdit->setPlaceholderText("https://print-automation.local");
    form->addRow("Server URL:", m_serverUrlEdit);

    m_apiTokenEdit = new QLineEdit();
    m_apiTokenEdit->setPlaceholderText("API token");
    m_apiTokenEdit->setEchoMode(QLineEdit::Password);
    form->addRow("API Token:", m_apiTokenEdit);
    layout->addLayout(form);

    auto *printerLabel = new QLabel("Available Printers:");
    layout->addWidget(printerLabel);

    m_printerList = new QListWidget();
    refreshPrinters();
    layout->addWidget(m_printerList);

    auto *refreshBtn = new QPushButton("Refresh Printer List");
    connect(refreshBtn, &QPushButton::clicked, this, &ConfigDialog::refreshPrinters);
    layout->addWidget(refreshBtn);

    auto *buttonLayout = new QHBoxLayout();
    auto *okBtn = new QPushButton("OK");
    auto *cancelBtn = new QPushButton("Cancel");
    connect(okBtn, &QPushButton::clicked, this, &ConfigDialog::accept);
    connect(cancelBtn, &QPushButton::clicked, this, &ConfigDialog::reject);
    buttonLayout->addStretch();
    buttonLayout->addWidget(okBtn);
    buttonLayout->addWidget(cancelBtn);
    layout->addLayout(buttonLayout);

    loadSettings();
}

void ConfigDialog::loadSettings()
{
    QSettings settings;
    m_serverUrlEdit->setText(settings.value("server/url", m_client->serverUrl()).toString());
    m_apiTokenEdit->setText(settings.value("server/token", m_client->apiToken()).toString());
}

void ConfigDialog::saveSettings()
{
    QSettings settings;
    settings.setValue("server/url", serverUrl());
    settings.setValue("server/token", apiToken());
}

void ConfigDialog::refreshPrinters()
{
    m_printerList->clear();
    QProcess proc;
    proc.start("powershell", QStringList() << "-NoProfile" << "-Command"
        << "Get-WmiObject Win32_Printer | Where-Object { $_.Name -notlike '*Microsoft*' -and $_.Name -notlike '*OneNote*' -and $_.Name -notlike '*XPS*' } | Select-Object -ExpandProperty Name");
    proc.waitForFinished(5000);
    QString output = QString::fromUtf8(proc.readAllStandardOutput()).trimmed();
    QStringList printers = output.split("\r\n", Qt::SkipEmptyParts);
    if (printers.isEmpty()) printers << "DefaultPrinter";
    for (const auto &name : printers) {
        auto *item = new QListWidgetItem(name.trimmed());
        item->setFlags(item->flags() | Qt::ItemIsUserCheckable);
        item->setCheckState(Qt::Checked);
        m_printerList->addItem(item);
    }
}

QString ConfigDialog::serverUrl() const { return m_serverUrlEdit->text(); }
QString ConfigDialog::apiToken() const { return m_apiTokenEdit->text(); }

QStringList ConfigDialog::selectedPrinters() const
{
    QStringList selected;
    for (int i = 0; i < m_printerList->count(); ++i) {
        if (m_printerList->item(i)->checkState() == Qt::Checked)
            selected.append(m_printerList->item(i)->text());
    }
    return selected;
}
