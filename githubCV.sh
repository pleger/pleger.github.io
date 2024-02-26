#!/bin/sh
cd ../pleger.github.io

cp ../resumepleger.pdf CVs/resume_paul_leger.pdf
cp ../industrial/resumepleger_Industrial.pdf CVs/resume_paul_leger_industrial.pdf
cp ../Spanish_CV/resumepleger_spanish.pdf CVs/resume_paul_leger_spanish.pdf

git commit -am "update CVs"
git push -u origin main

