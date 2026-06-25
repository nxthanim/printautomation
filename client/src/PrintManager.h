#ifndef PRINTMANAGER_H
#define PRINTMANAGER_H

#include <QObject>
#include <QProcess>
#include <functional>

class ServerClient;

class PrintManager : public QObject
{
    Q_OBJECT

public:
    explicit PrintManager(QObject *parent = nullptr);

    void setServerClient(ServerClient *client);

    void printPdf(const QString &jobId, const QString &pdfUrl,
                  const QString &printerName,
                  std::function<void(bool)> callback);
    void setSumatraPath(const QString &path);
    QString sumatraPath() const;

private:
    QString findSumatraPath() const;

    ServerClient *m_client;
    QString m_sumatraPath;
};

#endif
