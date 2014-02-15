#!/bin/bash
#
# build_database.sh - create empty presence database schema for to log presence in.
#
# Aevoid 21/01/2014
#forked from https://github.com/talltom/PiThermServer
#
sqlite3 presence.db 'DROP TABLE presence_records;'
sqlite3 presence.db 'CREATE TABLE presence_records(unix_time bigint primary key, present real);' 

