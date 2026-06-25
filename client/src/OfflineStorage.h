#ifndef OFFLINESTORAGE_H
#define OFFLINESTORAGE_H

#include <QObject>
#include <QSqlDatabase>
#include <QJsonArray>
#include <functional>

class ServerClient;

class OfflineStorage : public QObject
{
    Q_OBJECT

public:
    explicit OfflineStorage(QObject *parent = nullptr);
    ~OfflineStorage() override;

    void storeJobStatus(const QString &jobId, const QString &status);
    void syncPendingJobs(ServerClient *client);
    bool hasPendingSync() const;

signals:
    void syncComplete(int syncedCount);

private:
    void initDatabase();
    QSqlDatabase m_db;
};

#endif
