#include "JobMonitor.h"
#include <QProcess>
#include <QDebug>

JobMonitor::JobMonitor(QObject *parent)
    : QObject(parent)
    , m_checkTimer(new QTimer(this))
{
    connect(m_checkTimer, &QTimer::timeout, this, &JobMonitor::checkJobs);
    m_checkTimer->setInterval(2000);
}

void JobMonitor::startMonitoring(const QString &jobId,
                                  std::function<void(bool)> callback)
{
    m_monitoredJobs[jobId] = {callback, 0};
    if (!m_checkTimer->isActive())
        m_checkTimer->start();
}

void JobMonitor::stopMonitoring(const QString &jobId)
{
    m_monitoredJobs.remove(jobId);
    if (m_monitoredJobs.isEmpty())
        m_checkTimer->stop();
}

void JobMonitor::checkJobs()
{
    if (m_monitoredJobs.isEmpty()) {
        m_checkTimer->stop();
        return;
    }

    QStringList keysToRemove;

    for (auto it = m_monitoredJobs.begin(); it != m_monitoredJobs.end(); ++it) {
        const QString &jobId = it.key();
        auto &job = it.value();
        job.checkCount++;

        QString safeJobId = QString(jobId).replace("'", "''");
        QString psCmd = QString(
            "Get-WmiObject Win32_PrintJob | "
            "Where-Object { $_.Document -like '*%1*' } | "
            "Measure-Object | Select-Object -ExpandProperty Count"
        ).arg(safeJobId);

        QProcess wmi;
        wmi.start("powershell", QStringList()
            << "-NoProfile" << "-NonInteractive" << "-Command" << psCmd);
        wmi.waitForFinished(5000);
        QString output = QString::fromUtf8(wmi.readAllStandardOutput()).trimmed();
        int activeJobs = output.toInt();

        bool completed = false;
        if (activeJobs == 0 && job.checkCount >= 3) {
            completed = true;
        } else if (job.checkCount > 20) {
            qWarning() << "Job" << jobId << "monitoring timed out after 40s";
            completed = true;
        }

        if (completed) {
            emit jobStatusChanged(jobId, "completed");
            job.callback(true);
            keysToRemove.append(jobId);
        } else if (activeJobs > 0) {
            emit jobStatusChanged(jobId, "printing");
        } else {
            emit jobStatusChanged(jobId, "pending");
        }
    }

    for (const QString &key : keysToRemove)
        m_monitoredJobs.remove(key);

    if (m_monitoredJobs.isEmpty())
        m_checkTimer->stop();
}
