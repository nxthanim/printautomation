#include "MainWindow.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGroupBox>
#include <QHeaderView>
#include <QMessageBox>
#include <QJsonArray>
#include <QJsonObject>
#include <QJsonDocument>
#include <QSettings>
#include <QApplication>
#include <QDateTime>

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , m_printerTable(nullptr)
    , m_jobTable(nullptr)
    , m_historyTable(nullptr)
    , m_statusLabel(nullptr)
    , m_printAllBtn(nullptr)
    , m_settingsBtn(nullptr)
    , m_refreshTimer(new QTimer(this))
    , m_trayIcon(nullptr)
    , m_client(new ServerClient(this))
    , m_printManager(new PrintManager(this))
    , m_jobMonitor(new JobMonitor(this))
    , m_offlineStorage(new OfflineStorage(this))
{
    m_printManager->setServerClient(m_client);

    setupUI();
    setupSystemTray();

    connect(m_refreshTimer, &QTimer::timeout, this, &MainWindow::refreshDashboard);
    connect(m_printAllBtn, &QPushButton::clicked, this, &MainWindow::printAllPending);
    connect(m_settingsBtn, &QPushButton::clicked, this, &MainWindow::showSettings);
    connect(m_client, &ServerClient::registrationResult, this, &MainWindow::onRegistrationResult);
    connect(m_jobMonitor, &JobMonitor::jobStatusChanged, this, &MainWindow::onJobStatusChanged);
    connect(m_offlineStorage, &OfflineStorage::syncComplete, this, [this](int count) {
        m_statusLabel->setText(QString("Synced %1 offline job(s)").arg(count));
    });

    registerWithServer();
    m_refreshTimer->start(15000);
    refreshDashboard();
}

MainWindow::~MainWindow() {}

void MainWindow::setupUI()
{
    auto *central = new QWidget(this);
    auto *mainLayout = new QVBoxLayout(central);

    auto *titleBar = new QHBoxLayout();
    m_statusLabel = new QLabel("Initializing...");
    m_printAllBtn = new QPushButton("Print All Pending");
    m_settingsBtn = new QPushButton("Settings");
    titleBar->addWidget(m_statusLabel);
    titleBar->addStretch();
    titleBar->addWidget(m_printAllBtn);
    titleBar->addWidget(m_settingsBtn);
    mainLayout->addLayout(titleBar);

    auto *printerGroup = new QGroupBox("Printers");
    auto *printerLayout = new QVBoxLayout(printerGroup);
    m_printerTable = new QTableWidget(0, 4);
    m_printerTable->setHorizontalHeaderLabels({"Printer", "Status", "Active Jobs", "Last Seen"});
    m_printerTable->horizontalHeader()->setStretchLastSection(true);
    m_printerTable->setEditTriggers(QAbstractItemView::NoEditTriggers);
    m_printerTable->setSelectionBehavior(QAbstractItemView::SelectRows);
    printerLayout->addWidget(m_printerTable);
    mainLayout->addWidget(printerGroup);

    auto *jobGroup = new QGroupBox("Pending Jobs");
    auto *jobLayout = new QVBoxLayout(jobGroup);
    m_jobTable = new QTableWidget(0, 4);
    m_jobTable->setHorizontalHeaderLabels({"Job ID", "Order ID", "Printer", "Status"});
    m_jobTable->horizontalHeader()->setStretchLastSection(true);
    m_jobTable->setEditTriggers(QAbstractItemView::NoEditTriggers);
    jobLayout->addWidget(m_jobTable);
    mainLayout->addWidget(jobGroup);

    auto *historyGroup = new QGroupBox("Job History");
    auto *historyLayout = new QVBoxLayout(historyGroup);
    m_historyTable = new QTableWidget(0, 5);
    m_historyTable->setHorizontalHeaderLabels({"Job ID", "Order ID", "Printer", "Status", "Time"});
    m_historyTable->horizontalHeader()->setStretchLastSection(true);
    m_historyTable->setEditTriggers(QAbstractItemView::NoEditTriggers);
    historyLayout->addWidget(m_historyTable);
    mainLayout->addWidget(historyGroup);

    setCentralWidget(central);
}

void MainWindow::setupSystemTray()
{
    m_trayIcon = new QSystemTrayIcon(this);
    m_trayIcon->setToolTip("Print Automation Client");
    m_trayIcon->show();
}

void MainWindow::registerWithServer()
{
    m_client->registerClient();
}

void MainWindow::refreshDashboard()
{
    if (m_offlineStorage->hasPendingSync()) {
        m_offlineStorage->syncPendingJobs(m_client);
    }

    m_client->fetchPendingJobs([this](const QJsonArray &jobs) {
        m_jobTable->setRowCount(0);
        for (const auto &job : jobs) {
            QJsonObject obj = job.toObject();
            int row = m_jobTable->rowCount();
            m_jobTable->insertRow(row);
            m_jobTable->setItem(row, 0, new QTableWidgetItem(obj["job_id"].toString()));
            m_jobTable->setItem(row, 1, new QTableWidgetItem(obj["order_id"].toString()));
            m_jobTable->setItem(row, 2, new QTableWidgetItem(obj["printer_name"].toString()));
            m_jobTable->setItem(row, 3, new QTableWidgetItem("Pending"));
        }
        m_statusLabel->setText(QString("Ready - %1 pending jobs").arg(jobs.size()));
    });

    m_client->fetchDashboard([this](const QJsonObject &data) {
        QJsonArray printers = data["printers"].toArray();
        updatePrinterStatus(printers);
    });
}

void MainWindow::updatePrinterStatus(const QJsonArray &printers)
{
    m_printerTable->setRowCount(0);
    for (const auto &p : printers) {
        QJsonObject obj = p.toObject();
        int row = m_printerTable->rowCount();
        m_printerTable->insertRow(row);
        m_printerTable->setItem(row, 0, new QTableWidgetItem(obj["name"].toString()));
        auto *statusItem = new QTableWidgetItem(obj["status"].toString());
        QString status = obj["status"].toString();
        if (status == "idle")
            statusItem->setForeground(QColor(46, 125, 50));
        else if (status == "busy")
            statusItem->setForeground(QColor(245, 127, 23));
        else
            statusItem->setForeground(QColor(198, 40, 40));
        m_printerTable->setItem(row, 1, statusItem);
        m_printerTable->setItem(row, 2, new QTableWidgetItem(QString::number(obj["active_jobs"].toInt())));
        m_printerTable->setItem(row, 3, new QTableWidgetItem("Now"));
    }
}

void MainWindow::printAllPending()
{
    m_client->fetchPendingJobs([this](const QJsonArray &jobs) {
        for (const auto &job : jobs) {
            QJsonObject obj = job.toObject();
            QString jobId = obj["job_id"].toString();
            QString orderId = obj["order_id"].toString();
            QString printerName = obj["printer_name"].toString();
            QString pdfUrl = obj["pdf_url"].toString();

            m_printManager->printPdf(jobId, pdfUrl, printerName, [this, jobId, orderId, printerName](bool success) {
                if (success) {
                    m_jobMonitor->startMonitoring(jobId, [this, jobId, orderId, printerName](bool completed) {
                        if (completed) {
                            m_client->updateJobStatus(jobId, "completed", [this, jobId, orderId](bool ok) {
                                if (ok) {
                                    updateJobHistory(jobId, orderId, "", "Completed");
                                    m_client->downloadAndPrintReceipt(orderId);
                                } else {
                                    m_offlineStorage->storeJobStatus(jobId, "completed");
                                    updateJobHistory(jobId, orderId, "", "Completed (offline)");
                                }
                            });
                        }
                    });
                } else {
                    m_offlineStorage->storeJobStatus(jobId, "failed");
                    updateJobHistory(jobId, orderId, printerName, "Failed");
                }
            });
        }
    });
}

void MainWindow::showSettings()
{
    ConfigDialog dialog(m_client, this);
    if (dialog.exec() == ConfigDialog::Accepted) {
        QSettings settings;
        settings.setValue("server/url", dialog.serverUrl());
        settings.setValue("server/token", dialog.apiToken());
        QMessageBox::information(this, "Settings", "Settings saved. Reconnecting...");
        registerWithServer();
    }
}

void MainWindow::onJobStatusChanged(const QString &jobId, const QString &status)
{
    m_statusLabel->setText(QString("Job %1: %2").arg(jobId, status));
    m_trayIcon->showMessage("Job Update", QString("Job %1 is now %2").arg(jobId, status));
}

void MainWindow::onRegistrationResult(bool success, const QString &message)
{
    if (success) {
        m_statusLabel->setText("Registered with server");
    } else {
        m_statusLabel->setText("Registration failed: " + message);
    }
}

void MainWindow::updateJobHistory(const QString &jobId, const QString &orderId,
                                   const QString &printer, const QString &status)
{
    int row = m_historyTable->rowCount();
    m_historyTable->insertRow(row);
    m_historyTable->setItem(row, 0, new QTableWidgetItem(jobId));
    m_historyTable->setItem(row, 1, new QTableWidgetItem(orderId));
    m_historyTable->setItem(row, 2, new QTableWidgetItem(printer));
    m_historyTable->setItem(row, 3, new QTableWidgetItem(status));
    m_historyTable->setItem(row, 4, new QTableWidgetItem(QDateTime::currentDateTime().toString("hh:mm:ss")));
}
