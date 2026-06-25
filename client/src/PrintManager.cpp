#include "PrintManager.h"
#include "ServerClient.h"
#include <QCoreApplication>
#include <QDir>
#include <QFileInfo>
#include <QStandardPaths>
#include <QSettings>
#include <QFile>

PrintManager::PrintManager(QObject *parent)
    : QObject(parent)
    , m_client(nullptr)
{
    QSettings settings;
    m_sumatraPath = settings.value("printing/sumatra_path", "").toString();
    if (m_sumatraPath.isEmpty())
        m_sumatraPath = findSumatraPath();
}

void PrintManager::setServerClient(ServerClient *client)
{
    m_client = client;
}

QString PrintManager::findSumatraPath() const
{
    QStringList candidates = {
        QCoreApplication::applicationDirPath() + "/SumatraPDF.exe",
        QCoreApplication::applicationDirPath() + "/bin/SumatraPDF.exe",
        "C:/Program Files/SumatraPDF/SumatraPDF.exe",
        "C:/Program Files (x86)/SumatraPDF/SumatraPDF.exe",
    };
    for (const auto &path : candidates) {
        if (QFileInfo::exists(path))
            return path;
    }
    return "SumatraPDF.exe";
}

void PrintManager::setSumatraPath(const QString &path)
{
    m_sumatraPath = path;
    QSettings settings;
    settings.setValue("printing/sumatra_path", path);
}

QString PrintManager::sumatraPath() const { return m_sumatraPath; }

void PrintManager::printPdf(const QString &jobId, const QString &pdfUrl,
                             const QString &printerName,
                             std::function<void(bool)> callback)
{
    if (!m_client) {
        qWarning() << "ServerClient not set on PrintManager";
        callback(false);
        return;
    }

    QString tempDir = QStandardPaths::writableLocation(QStandardPaths::TempLocation);
    QString pdfPath = tempDir + "/print_job_" + jobId + ".pdf";

    m_client->downloadFile(pdfUrl, pdfPath, [this, pdfPath, printerName, callback](bool ok) {
        if (!ok) {
            callback(false);
            return;
        }

        auto *process = new QProcess(this);
        QStringList args;
        args << "-print-to" << printerName
             << "-silent"
             << "-exit-on-print"
             << pdfPath;

        connect(process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished),
                this, [process, pdfPath, callback](int exitCode, QProcess::ExitStatus status) {
            process->deleteLater();
            QFile::remove(pdfPath);
            callback(exitCode == 0 && status == QProcess::NormalExit);
        });

        process->start(m_sumatraPath, args);
    });
}
