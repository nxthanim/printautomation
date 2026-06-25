#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <QTableWidget>
#include <QLabel>
#include <QPushButton>
#include <QTimer>
#include <QSystemTrayIcon>
#include "ServerClient.h"
#include "PrintManager.h"
#include "JobMonitor.h"
#include "OfflineStorage.h"
#include "ConfigDialog.h"

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow() override;

private slots:
    void refreshDashboard();
    void printAllPending();
    void showSettings();
    void onJobStatusChanged(const QString &jobId, const QString &status);
    void onRegistrationResult(bool success, const QString &message);

private:
    void setupUI();
    void setupSystemTray();
    void registerWithServer();
    void loadPendingJobs();
    void updatePrinterStatus(const QJsonArray &printers);
    void updateJobHistory(const QString &jobId, const QString &orderId,
                          const QString &printer, const QString &status);

    QTableWidget *m_printerTable;
    QTableWidget *m_jobTable;
    QTableWidget *m_historyTable;
    QLabel *m_statusLabel;
    QPushButton *m_printAllBtn;
    QPushButton *m_settingsBtn;
    QTimer *m_refreshTimer;
    QSystemTrayIcon *m_trayIcon;

    ServerClient *m_client;
    PrintManager *m_printManager;
    JobMonitor *m_jobMonitor;
    OfflineStorage *m_offlineStorage;
};

#endif
