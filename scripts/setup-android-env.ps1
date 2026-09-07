$androidSdk = "C:\Users\macie\AppData\Local\Android\Sdk"
$ndkPath = "C:\Users\macie\AppData\Local\Android\Sdk\ndk\27.2.12479018"
$javaHome = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$cargoBin = "C:\Users\macie\.cargo\bin"
$androidStudioBin = "C:\Program Files\Android\Android Studio\bin"

Write-Host "Setting User Environment Variables..."
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', $androidSdk, 'User')
[System.Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $androidSdk, 'User')
[System.Environment]::SetEnvironmentVariable('NDK_HOME', $ndkPath, 'User')
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', $javaHome, 'User')

$userPath = [System.Environment]::GetEnvironmentVariable('PATH', 'User')
$entries = @(
    $cargoBin,
    "$javaHome\bin",
    "$androidSdk\platform-tools",
    "$androidSdk\cmdline-tools\latest\bin",
    $androidStudioBin
)

foreach ($entry in $entries) {
    if (-not $userPath.Contains($entry)) {
        $userPath = "$entry;$userPath"
    }
}
[System.Environment]::SetEnvironmentVariable('PATH', $userPath, 'User')

Write-Host "Configured permanent User environment variables successfully!"
