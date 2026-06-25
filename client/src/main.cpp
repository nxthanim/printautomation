#include <QApplication>
#include <QIcon>
#include "MainWindow.h"

int main(int argc, char *argv[])
{
    QApplication app(argc, argv);
    app.setApplicationName("Print Automation Client");
    app.setApplicationVersion("1.0.0");
    app.setOrganizationName("PrintAutomation");

    MainWindow window;
    window.setWindowTitle("Print Automation Client");
    window.resize(1024, 768);
    window.show();

    return app.exec();
}
