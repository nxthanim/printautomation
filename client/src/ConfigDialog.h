#ifndef CONFIGDIALOG_H
#define CONFIGDIALOG_H

#include <QDialog>
#include <QLineEdit>
#include <QListWidget>

class ServerClient;

class ConfigDialog : public QDialog
{
    Q_OBJECT

public:
    explicit ConfigDialog(ServerClient *client, QWidget *parent = nullptr);

    QString serverUrl() const;
    QString apiToken() const;
    QStringList selectedPrinters() const;

private:
    void loadSettings();
    void saveSettings();
    void refreshPrinters();

    ServerClient *m_client;
    QLineEdit *m_serverUrlEdit;
    QLineEdit *m_apiTokenEdit;
    QListWidget *m_printerList;
};

#endif
