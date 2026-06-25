cmake_minimum_required(VERSION 3.20)
project(PrintAutomationClient VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 REQUIRED COMPONENTS Widgets Network Sql)

set(SOURCES
    src/main.cpp
    src/MainWindow.cpp
    src/ServerClient.cpp
    src/PrintManager.cpp
    src/JobMonitor.cpp
    src/OfflineStorage.cpp
    src/ConfigDialog.cpp
)

set(HEADERS
    src/MainWindow.h
    src/ServerClient.h
    src/PrintManager.h
    src/JobMonitor.h
    src/OfflineStorage.h
    src/ConfigDialog.h
)

add_executable(PrintAutomationClient ${SOURCES} ${HEADERS})

target_link_libraries(PrintAutomationClient PRIVATE
    Qt6::Widgets
    Qt6::Network
    Qt6::Sql
)

target_include_directories(PrintAutomationClient PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)

install(TARGETS PrintAutomationClient DESTINATION bin)
