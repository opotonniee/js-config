#!/bin/sh

rm -rf doc
jsdoc -d doc dist

case $(uname -a) in
  MINGW* | CYGWIN*)
    for f in doc/* doc/fonts/*.svg doc/scripts/* doc/scripts/prettify/* doc/styles/*.css ; do
      if [ -f "$f" ] ; then
        unix2dos "$f"
      fi
    done
    ;;
  *)
esac
