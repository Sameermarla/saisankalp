# Sai Sankalp launcher and guidance script

Write-Host "==================================================" -ForegroundColor Green
Write-Host "        WELCOME TO SAI SANKALP" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

Write-Host "We have built a beautiful static frontend and a native Java server."
Write-Host "Since Python is already configured on this machine, we can run a dev server instantly."
Write-Host ""
Write-Host "OPTION 1: Run via Python (Instant Testing)" -ForegroundColor Yellow
Write-Host "Starting python server at http://localhost:8000 ..."
Write-Host "Press Ctrl+C inside the terminal to stop."
Write-Host ""

# Start the Python database server
python mock_server.py

Write-Host ""
Write-Host "OPTION 2: Compile & Run via Java (Requires Java JDK to be installed)" -ForegroundColor Yellow
Write-Host "If you install Java JDK later, you can compile and run this app using these commands:"
Write-Host "1. Compile the server:   javac Server.java"
Write-Host "2. Run the server:       java Server"
Write-Host "3. Access server at:     http://localhost:8080"
Write-Host ""
