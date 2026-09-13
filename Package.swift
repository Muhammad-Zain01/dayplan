// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "DayPlan",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "DayPlan", targets: ["DayPlan"]),
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
            linkerSettings: [
                .linkedFramework("Security"),
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
