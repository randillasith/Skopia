$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$connectorVersion = '8.4.0'
$connector = Join-Path $PSScriptRoot "lib\mysql-connector-j-$connectorVersion.jar"
$output = Join-Path $PSScriptRoot 'out'

if (-not (Test-Path -LiteralPath $connector)) {
    Write-Host 'Downloading MySQL Connector/J (first run only)...' -ForegroundColor Cyan
    $url = "https://repo.maven.apache.org/maven2/com/mysql/mysql-connector-j/$connectorVersion/mysql-connector-j-$connectorVersion.jar"
    Invoke-WebRequest -Uri $url -OutFile $connector
}

if (-not (Test-Path -LiteralPath $output)) {
    New-Item -ItemType Directory -Path $output | Out-Null
}

$sources = @(Get-ChildItem -LiteralPath 'src\main\java' -Filter '*.java' -Recurse | ForEach-Object { $_.FullName })
Write-Host 'Compiling Skopia...' -ForegroundColor Cyan
& javac -encoding UTF-8 -cp $connector -d $output @sources
if ($LASTEXITCODE -ne 0) { throw 'Java compilation failed.' }

Write-Host 'Starting Skopia at http://localhost:8080' -ForegroundColor Green
& java -cp "$output;$connector" com.skopia.SkopiaServer
