#ifndef SERVERCLIENT_H
#define SERVERCLIENT_H

#include <QObject>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QJsonArray>
#include <QJsonObject>
#include <functional>

class ServerClient : public QObject
{
    Q_OBJECT

public:
    explicit ServerClient(QObject *parent = nullptr);

    void setServerUrl(const QString &url);
    void setApiToken(const QString &token);
    QString serverUrl() const;
    QString apiToken() const;

    void registerClient();
    void fetchPendingJobs(std::function<void(const QJsonArray &)> callback);
    void fetchDashboard(std::function<void(const QJsonObject &)> callback);
    void updateJobStatus(const QString &jobId, const QString &status,
                         std::function<void(bool)> callback);
    void downloadAndPrintReceipt(const QString &orderId);
    void downloadFile(const QString &url, const QString &destPath,
                      std::function<void(bool)> callback);

signals:
    void registrationResult(bool success, const QString &message);

private:
    QNetworkRequest makeRequest(const QString &path);
    QStringList getPrinterNames();

    QNetworkAccessManager *m_manager;
    QString m_serverUrl;
    QString m_apiToken;
    QString m_clientId;
};

#endif
