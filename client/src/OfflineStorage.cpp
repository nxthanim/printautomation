#include "OfflineStorage.h"
#include "ServerClient.h"
#include <QSqlQuery>
#include <QSqlError>
#include <QStandardPaths>
#include <QDir>
#include <QJsonObject>
#include <QJsonDocument>
#include <QDebug>
#include <memory>
#include <atomic>

OfflineStorage::OfflineStorage(QObject *parent)
    : QObject(parent)
{
    initDatabase();
}

OfflineStorage::~OfflineStorage()
{
    if (m_db.isOpen())
        m_db.close();
}

void OfflineStorage::initDatabase()
{
    QString dbPath = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir().mkpath(dbPath);
    dbPath += "/offline_cache.db";

    m_db = QSqlDatabase::addDatabase("QSQLITE", "offline");
    m_db.setDatabaseName(dbPath);

    if (!m_db.open()) {
        qWarning() << "Failed to open offline database:" << m_db.lastError().text();
        return;
    }

    QSqlQuery query(m_db);
    if (!query.exec(
        "CREATE TABLE IF NOT EXISTS pending_jobs ("
        "  job_id TEXT PRIMARY KEY,"
        "  status TEXT NOT NULL,"
        "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP"
        ")"
    )) {
        qWarning() << "Failed to create pending_jobs table:" << query.lastError().text();
    }
}

void OfflineStorage::storeJobStatus(const QString &jobId, const QString &status)
{
    if (!m_db.isOpen()) {
        qWarning() << "Offline database not open";
        return;
    }
    QSqlQuery query(m_db);
    query.prepare("INSERT OR REPLACE INTO pending_jobs (job_id, status) VALUES (?, ?)");
    query.addBindValue(jobId);
    query.addBindValue(status);
    if (!query.exec())
        qWarning() << "Failed to store job status:" << query.lastError().text();
}

void OfflineStorage::syncPendingJobs(ServerClient *client)
{
    if (!m_db.isOpen()) {
        emit syncComplete(0);
        return;
    }

    QSqlQuery query(m_db);
    if (!query.exec("SELECT job_id, status FROM pending_jobs")) {
        qWarning() << "Failed to query pending jobs:" << query.lastError().text();
        emit syncComplete(0);
        return;
    }

    struct Entry { QString jobId; QString status; };
    QVector<Entry> jobs;
    while (query.next()) {
        jobs.append({query.value(0).toString(), query.value(1).toString()});
    }

    if (jobs.isEmpty()) {
        emit syncComplete(0);
        return;
    }

    auto counter = std::make_shared<std::atomic<int>>(0);
    int total = jobs.size();

    for (const auto &entry : jobs) {
        client->updateJobStatus(entry.jobId, entry.status,
            [this, jobId = entry.jobId, counter, total](bool ok) {
            if (ok) {
                QSqlQuery del(m_db);
                del.prepare("DELETE FROM pending_jobs WHERE job_id = ?");
                del.addBindValue(jobId);
                if (!del.exec()) {
                    qWarning() << "Failed to delete synced job:" << del.lastError().text();
                }
            }
            int completedCount = counter->fetch_add(1) + 1;
            if (completedCount >= total) {
                emit syncComplete(std::min(completedCount, total));
            }
        });
    }
}

bool OfflineStorage::hasPendingSync() const
{
    if (!m_db.isOpen())
        return false;
    QSqlQuery query(m_db);
    query.exec("SELECT COUNT(*) FROM pending_jobs");
    if (query.next()) return query.value(0).toInt() > 0;
    return false;
}
