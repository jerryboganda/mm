[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F]{64}$')]
    [string]$ExpectedSourceSha256
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedSource = (Resolve-Path -LiteralPath $SourcePath -ErrorAction Stop).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = [System.IO.Path]::GetDirectoryName($resolvedOutput)

if (-not [System.IO.File]::Exists($resolvedSource)) {
    throw "EMF source does not exist: $resolvedSource"
}
if ([System.IO.File]::Exists($resolvedOutput)) {
    throw "Refusing to overwrite an existing EMF derivative: $resolvedOutput"
}
if (-not [System.IO.Directory]::Exists($outputDirectory)) {
    throw "EMF output directory does not exist: $outputDirectory"
}

$actualSourceSha256 = (Get-FileHash -LiteralPath $resolvedSource -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSourceSha256 -ne $ExpectedSourceSha256.ToLowerInvariant()) {
    throw "EMF source digest mismatch: expected $ExpectedSourceSha256, got $actualSourceSha256"
}

try {
    Add-Type -AssemblyName System.Drawing.Common -ErrorAction Stop
} catch {
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop
}

$temporaryOutput = [System.IO.Path]::Combine(
    $outputDirectory,
    ([System.IO.Path]::GetFileName($resolvedOutput) + '.' + [System.Guid]::NewGuid().ToString('N') + '.tmp')
)

$metafile = $null
$bitmap = $null
$graphics = $null
$decoded = $null
try {
    $metafile = [System.Drawing.Imaging.Metafile]::new($resolvedSource)
    $width = [int]$metafile.Width
    $height = [int]$metafile.Height
    if ($width -le 0 -or $height -le 0) {
        throw "GDI+ reported invalid EMF dimensions ${width}x${height}"
    }

    $pixelFormat = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    $bitmap = [System.Drawing.Bitmap]::new($width, $height, $pixelFormat)
    if ($metafile.HorizontalResolution -gt 0 -and $metafile.VerticalResolution -gt 0) {
        $bitmap.SetResolution($metafile.HorizontalResolution, $metafile.VerticalResolution)
    }
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.DrawImage($metafile, [System.Drawing.Rectangle]::new(0, 0, $width, $height))
    $bitmap.Save($temporaryOutput, [System.Drawing.Imaging.ImageFormat]::Png)

    $decoded = [System.Drawing.Image]::FromFile($temporaryOutput)
    if ($decoded.Width -ne $width -or $decoded.Height -ne $height) {
        throw "Decoded PNG dimensions differ: expected ${width}x${height}, got $($decoded.Width)x$($decoded.Height)"
    }
    if (-not [System.Drawing.Image]::IsAlphaPixelFormat($decoded.PixelFormat)) {
        throw "Decoded PNG does not retain an alpha-capable pixel format"
    }
    $decoded.Dispose()
    $decoded = $null

    $signature = [System.IO.File]::ReadAllBytes($temporaryOutput)
    $expectedSignature = [byte[]](137, 80, 78, 71, 13, 10, 26, 10)
    for ($index = 0; $index -lt $expectedSignature.Length; $index++) {
        if ($signature[$index] -ne $expectedSignature[$index]) {
            throw "GDI+ derivative has an invalid PNG signature"
        }
    }

    [System.IO.File]::Move($temporaryOutput, $resolvedOutput)
    [pscustomobject]@{
        renderer = 'Windows GDI+'
        width = $width
        height = $height
        sourceSha256 = $actualSourceSha256
        outputSha256 = (Get-FileHash -LiteralPath $resolvedOutput -Algorithm SHA256).Hash.ToLowerInvariant()
    } | ConvertTo-Json -Compress
}
finally {
    if ($null -ne $decoded) { $decoded.Dispose() }
    if ($null -ne $graphics) { $graphics.Dispose() }
    if ($null -ne $bitmap) { $bitmap.Dispose() }
    if ($null -ne $metafile) { $metafile.Dispose() }
    if ([System.IO.File]::Exists($temporaryOutput)) {
        [System.IO.File]::Delete($temporaryOutput)
    }
}
