// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "DayPlan",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "DayPlan", targets: ["DayPlan"]),
        .executable(name: "DayPlanMCPServer", targets: ["DayPlanMCPServer"]),
    ],
    targets: [
        .systemLibrary(
            name: "CSQLite",
            path: "Sources/CSQLite"
        ),
        .executableTarget(
            name: "DayPlan",
            dependencies: ["CSQLite"],
            path: "Sources/DayPlan",
            exclude: ["AI/MCP"],
            linkerSettings: [
                .linkedFramework("Security"),
            ]
        ),
        .executableTarget(
            name: "DayPlanMCPServer",
            path: "Sources/DayPlanMCPServer",
            linkerSettings: [
                .linkedFramework("Security"),
                .linkedFramework("AppKit"),
            ]
        ),
        .testTarget(
            name: "DayPlanTests",
            dependencies: ["DayPlan", "CSQLite"],
            path: "Tests/DayPlanTests"
        ),
    ],
    swiftLanguageModes: [.v6]
)
