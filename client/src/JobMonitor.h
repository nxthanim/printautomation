#ifndef JOBMONITOR_H
#define JOBMONITOR_H

#include <QObject>
#include <QTimer>
#include <QMap>
#include <functional>

class JobMonitor : public QObject
{
    Q_OBJECT

public:
    explicit JobMonitor(QObject *parent = nullptr);

    void startMonitoring(const QString &jobId,
                         std::function<void(bool)> callback);
    void stopMonitoring(const QString &jobId);

signals:
    void jobStatusChanged(const QString &jobId, const QString &status);

private slots:
    void checkJobs();

private:
    struct MonitoredJob {
        std::function<void(bool)> callback;
        int checkCount;
    };

    QMap<QString, MonitoredJob> m_monitoredJobs;
    QTimer *m_checkTimer;
};

#endif
