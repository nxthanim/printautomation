#include "ServerClient.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QSettings>
#include <QDir>
#include <QProcess>
#include <QStandardPaths>
#include <QUrl>
#include <QFile>
#include <QSysInfo>

ServerClient::ServerClient(QObject *parent)
    : QObject(parent)
    , m_manager(new QNetworkAccessManager(this))
{
    QSettings settings;
    m_serverUrl = settings.value("server/url", "https://print-automation.local").toString();
    m_apiToken = settings.value("server/token", "").toString();
}

void ServerClient::setServerUrl(const QString &url) { m_serverUrl = url; }
void ServerClient::setApiToken(const QString &token) { m_apiToken = token; }
QString ServerClient::serverUrl() const { return m_serverUrl; }
QString ServerClient::apiToken() const { return m_apiToken; }

QNetworkRequest ServerClient::makeRequest(const QString &path)
{
    QNetworkRequest request(QUrl(m_serverUrl + path));
    request.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    request.setRawHeader("Authorization", ("Bearer " + m_apiToken).toUtf8());
    return request;
}

QStringList ServerClient::getPrinterNames()
{
    QStringList printers;
    QProcess proc;
    proc.start("powershell", QStringList() << "-NoProfile" << "-Command"
        << "Get-WmiObject Win32_Printer | Where-Object { $_.Name -notlike '*Microsoft*' -and $_.Name -notlike '*OneNote*' -and $_.Name -notlike '*XPS*' } | Select-Object -ExpandProperty Name");
    proc.waitForFinished(5000);
    QString output = QString::fromUtf8(proc.readAllStandardOutput()).trimmed();
    for (const auto &name : output.split("\r\n", Qt::SkipEmptyParts))
        printers.append(name.trimmed());
    if (printers.isEmpty())
        printers << "DefaultPrinter";
    return printers;
}

void ServerClient::registerClient()
{
    QJsonObject body;
    body["client_name"] = QSysInfo::machineHostName();
    body["api_token"] = m_apiToken;
    QJsonArray printers;
    for (const auto &name : getPrinterNames())
        printers.append(name);
    body["printers"] = printers;

    QNetworkReply *reply = m_manager->post(
        makeRequest("/api/register"),
        QJsonDocument(body).toJson()
    );

    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() == QNetworkReply::NoError) {
            QJsonObject resp = QJsonDocument::fromJson(reply->readAll()).object();
            m_clientId = resp["client_id"].toString();
            emit registrationResult(true, "Registered");
        } else {
            emit registrationResult(false, reply->errorString());
        }
    });
}

void ServerClient::fetchPendingJobs(std::function<void(const QJsonArray &)> callback)
{
    QNetworkReply *reply = m_manager->get(makeRequest(
        QString("/api/jobs/pending?client_id=%1").arg(m_clientId)));

    connect(reply, &QNetworkReply::finished, this, [reply, callback]() {
        reply->deleteLater();
        if (reply->error() == QNetworkReply::NoError) {
            QJsonArray arr = QJsonDocument::fromJson(reply->readAll()).array();
            callback(arr);
        } else {
            callback(QJsonArray());
        }
    });
}

void ServerClient::fetchDashboard(std::function<void(const QJsonObject &)> callback)
{
    QNetworkReply *reply = m_manager->get(makeRequest("/api/dashboard"));

    connect(reply, &QNetworkReply::finished, this, [reply, callback]() {
        reply->deleteLater();
        if (reply->error() == QNetworkReply::NoError) {
            QJsonObject obj = QJsonDocument::fromJson(reply->readAll()).object();
            callback(obj);
        } else {
            callback(QJsonObject());
        }
    });
}

void ServerClient::updateJobStatus(const QString &jobId, const QString &status,
                                    std::function<void(bool)> callback)
{
    QJsonObject body;
    body["job_id"] = jobId;
    body["status"] = status;

    QNetworkReply *reply = m_manager->post(
        makeRequest("/api/jobs/status"),
        QJsonDocument(body).toJson()
    );

    connect(reply, &QNetworkReply::finished, this, [reply, callback]() {
        reply->deleteLater();
        callback(reply->error() == QNetworkReply::NoError);
    });
}

void ServerClient::downloadAndPrintReceipt(const QString &orderId)
{
    QString destPath = QDir(QStandardPaths::writableLocation(
        QStandardPaths::TempLocation)).filePath("receipt_" + orderId + ".xlsx");

    downloadFile(QString("/api/receipts/%1/download").arg(orderId), destPath,
        [destPath](bool ok) {
        if (!ok) {
            qWarning() << "Failed to download receipt";
            return;
        }
        QString safePath = QString(destPath).replace("'", "''");
        QString psCmd = QString("Start-Process -FilePath '%1' -Verb Print -WindowStyle Hidden")
            .arg(safePath);
        QProcess::startDetached("powershell", QStringList() << "-Command" << psCmd);
    });
}

void ServerClient::downloadFile(const QString &url, const QString &destPath,
                                 std::function<void(bool)> callback)
{
    QNetworkReply *reply = m_manager->get(makeRequest(url));

    connect(reply, &QNetworkReply::finished, this, [reply, destPath, callback]() {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            qWarning() << "Download failed:" << reply->errorString();
            callback(false);
            return;
        }
        QFile file(destPath);
        if (!file.open(QIODevice::WriteOnly)) {
            qWarning() << "Cannot write to:" << destPath;
            callback(false);
            return;
        }
        file.write(reply->readAll());
        file.close();
        callback(true);
    });
}
